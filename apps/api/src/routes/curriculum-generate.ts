import { zValidator } from "@hono/zod-validator";
import {
  aiCurriculumSchema,
  checkProposal,
  curriculumGenerationMessages,
  MAX_SOURCE_CHARS,
  normalizeAiCurriculum,
  parseCurriculumImport,
  planCurriculumImport,
  proposalToYaml,
} from "@wema/curriculum";
import {
  applyCurriculumImport,
  createAuditLog,
  createCurriculumStore,
  createOrganizationStore,
} from "@wema/db";
import { asCountryId } from "@wema/domain";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { extractText, getDocumentProxy } from "unpdf";
import { z } from "zod";
import type { Deps, Env } from "../context";
import { fail, requirePermission, requireSession } from "../http";
import { createRateLimiter } from "../rate-limit";

/** Taille maximale d'un PDF ou d'un fichier texte téléversé. */
const MAX_SOURCE_BYTES = 10 * 1024 * 1024;

const target = {
  grade: z.string().trim().min(1).max(200),
  subject: z.string().trim().min(1).max(64),
};

/**
 * Programme proposé par l'IA à partir du texte officiel (super admin) :
 * extraction du texte d'un PDF, proposition (validée par Zod, codes uniques,
 * pas de cycle), puis import par le chemin de l'import existant (YAML au
 * format de content/curriculum), qui crée les notions « à valider ».
 */
export function curriculumGenerateRoutes(deps: Deps) {
  const store = createCurriculumStore(deps.db);
  // Chaque proposition coûte un appel au modèle de raisonnement.
  const limiter = createRateLimiter({
    max: 20,
    windowMs: 60 * 60 * 1000,
    now: deps.now,
  });

  const knownCodes = (rows: {
    notions: readonly { code: string; archived: boolean }[];
  }) => new Set(rows.notions.filter((n) => !n.archived).map((n) => n.code));

  const param = zValidator("param", z.object({ id: z.uuid() }));
  const proposalBody = zValidator(
    "json",
    z.object({ ...target, proposal: z.unknown() }),
  );

  /** Proposition relue → plan de l'import existant. */
  const planFor = async (
    countryId: string,
    body: { grade: string; subject: string; proposal: unknown },
  ) => {
    const current = await store.loadCountry(asCountryId(countryId));
    if (!current) return { kind: "not_found" as const };
    const checked = checkProposal(body.proposal, knownCodes(current));
    if (!checked.ok)
      return { kind: "invalid_proposal" as const, issues: checked.error };
    const parsed = parseCurriculumImport(
      "yaml",
      proposalToYaml(checked.value, body.grade, body.subject),
    );
    if (!parsed.ok) return { kind: "invalid" as const, issues: parsed.error };
    const plan = planCurriculumImport(current, parsed.value);
    if (!plan.ok) return { kind: "invalid" as const, issues: plan.error };
    return { kind: "ok" as const, plan: plan.value, country: current.country };
  };

  return (
    new Hono<Env>()
      .use(requireSession(deps))
      // L'écran ne propose la génération que si un fournisseur d'IA est configuré.
      .get("/status", requirePermission("curriculum.write"), (c) =>
        c.json({ aiConfigured: deps.aiConfigured }, 200),
      )
      .post(
        "/countries/:id/source",
        requirePermission("curriculum.write"),
        param,
        bodyLimit({
          maxSize: MAX_SOURCE_BYTES + 64 * 1024,
          onError: (c) => fail(c, 413, "file_too_large"),
        }),
        async (c) => {
          const form = await c.req.parseBody().catch(() => null);
          const file = form?.file;
          if (!(file instanceof File) || file.size === 0)
            return fail(c, 422, "file_missing");
          if (file.size > MAX_SOURCE_BYTES)
            return fail(c, 413, "file_too_large");
          const bytes = new Uint8Array(await file.arrayBuffer());
          const isPdf =
            bytes[0] === 0x25 &&
            bytes[1] === 0x50 &&
            bytes[2] === 0x44 &&
            bytes[3] === 0x46; // « %PDF »
          let text: string;
          if (isPdf) {
            try {
              const pdf = await getDocumentProxy(bytes);
              text = (await extractText(pdf, { mergePages: true })).text;
            } catch {
              return fail(c, 422, "file_unreadable");
            }
          } else {
            text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
            // Un fichier binaire autre qu'un PDF n'est pas du texte.
            if (text.includes("\u0000"))
              return fail(c, 415, "file_unsupported");
          }
          text = text.replace(/[ \t]+\n/g, "\n").trim();
          if (text === "") return fail(c, 422, "file_empty");
          return c.json(
            {
              text: text.slice(0, MAX_SOURCE_CHARS),
              truncated: text.length > MAX_SOURCE_CHARS,
            },
            200,
          );
        },
      )
      .post(
        "/countries/:id/generate",
        requirePermission("curriculum.write"),
        param,
        zValidator(
          "json",
          z.object({
            ...target,
            source: z.string().trim().min(1).max(MAX_SOURCE_CHARS),
          }),
        ),
        async (c) => {
          const current = await store.loadCountry(
            asCountryId(c.req.valid("param").id),
          );
          if (!current) return fail(c, 404, "not_found");
          const body = c.req.valid("json");
          const subject = current.subjects.find((s) => s.code === body.subject);
          if (!subject) return fail(c, 422, "unknown_subject");
          if (!deps.aiConfigured) return fail(c, 503, "ai_not_configured");
          if (!limiter.hit(c.get("user").id))
            return fail(c, 429, "too_many_requests");
          const platform = await createOrganizationStore(
            deps.db,
          ).getPlatformOrganization();
          const response = await deps.ai.generateObject(
            {
              task: "curriculum.generate",
              context: {
                organizationId: platform?.id ?? null,
                learnerId: null,
              },
              maxTokens: 16000,
              messages: curriculumGenerationMessages({
                source: body.source,
                country: current.country.name,
                grade: body.grade,
                subject: subject.name,
                unitLabel: current.country.unitLabel.plural,
              }),
            },
            aiCurriculumSchema,
            "programme",
          );
          if (!response.ok)
            return fail(
              c,
              response.error.kind === "misconfigured" ? 503 : 502,
              response.error.kind === "misconfigured"
                ? "ai_not_configured"
                : "ai_unavailable",
            );
          const proposal = normalizeAiCurriculum(response.value.object);
          const known = knownCodes(current);
          const checked = checkProposal(proposal, known);
          // Une proposition imparfaite (cycle, prérequis inconnu) est rendue
          // quand même, avec ses problèmes : l'admin la corrige à la relecture.
          return c.json(
            {
              proposal,
              issues: checked.ok ? [] : checked.error,
              existingCodes: [...known],
            },
            200,
          );
        },
      )
      .post(
        "/countries/:id/proposal/check",
        requirePermission("curriculum.write"),
        param,
        proposalBody,
        async (c) => {
          const r = await planFor(c.req.valid("param").id, c.req.valid("json"));
          if (r.kind === "not_found") return fail(c, 404, "not_found");
          if (r.kind === "invalid_proposal")
            return fail(c, 422, "invalid_proposal", r.issues);
          if (r.kind === "invalid")
            return fail(c, 422, "invalid_import", r.issues);
          return c.json({ summary: r.plan.summary, empty: r.plan.empty }, 200);
        },
      )
      .post(
        "/countries/:id/proposal/apply",
        requirePermission("curriculum.write"),
        param,
        proposalBody,
        async (c) => {
          const id = c.req.valid("param").id;
          const r = await planFor(id, c.req.valid("json"));
          if (r.kind === "not_found") return fail(c, 404, "not_found");
          if (r.kind === "invalid_proposal")
            return fail(c, 422, "invalid_proposal", r.issues);
          if (r.kind === "invalid")
            return fail(c, 422, "invalid_import", r.issues);
          if (!r.plan.empty) {
            // Les notions créées sont « à valider » : rien n'est validé ici.
            await applyCurriculumImport(deps.db, r.country.id, r.plan.changes);
            const s = r.plan.summary;
            await createAuditLog(deps.db).append({
              actorId: c.get("user").id,
              organizationId:
                (
                  await createOrganizationStore(
                    deps.db,
                  ).getPlatformOrganization()
                )?.id ?? null,
              action: "curriculum.import",
              targetType: "country",
              targetId: id,
              details: {
                format: "ai_proposal",
                grades: s.grades.length,
                programs: s.programs.length,
                units: s.units.length,
                newNotions: s.newNotions,
                updatedNotions: s.updatedNotions.map((u) => u.code),
                prerequisites: s.prerequisites.length,
              },
            });
          }
          return c.json(
            { ok: true, summary: r.plan.summary, empty: r.plan.empty },
            200,
          );
        },
      )
  );
}
