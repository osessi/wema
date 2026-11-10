import { zValidator } from "@hono/zod-validator";
import {
  exportCurriculumYaml,
  exportNotionsCsv,
  parseCurriculumImport,
  planCurriculumImport,
} from "@wema/curriculum";
import {
  applyCurriculumImport,
  createAuditLog,
  createCurriculumStore,
  createExerciseStore,
  createOrganizationStore,
} from "@wema/db";
import { asCountryId, type NotionId } from "@wema/domain";
import { parseExerciseYaml, validateIntent } from "@wema/exercises";
import { type Context, Hono } from "hono";
import { z } from "zod";
import type { Deps, Env } from "../context";
import { allowed, fail, requirePermission, requireSession } from "../http";

/** Taille maximale d'un fichier importé (texte). */
const MAX_IMPORT = 1_000_000;
/** Exercices au plus par import : chacun est vérifié par services/math (3 niveaux). */
const MAX_EXERCISES = 200;

const importBody = z.object({
  format: z.enum(["yaml", "csv"]),
  content: z.string().max(MAX_IMPORT),
});

/**
 * Import et export du référentiel d'un pays (YAML de content/curriculum, CSV
 * des notions), avec aperçu avant application, et import en masse
 * d'exercices dans la bibliothèque Wema, vérifiés par services/math.
 */
export function curriculumTransferRoutes(deps: Deps) {
  const store = createCurriculumStore(deps.db);
  const platform = async () =>
    (await createOrganizationStore(deps.db).getPlatformOrganization())?.id ??
    null;

  const planFor = async (
    countryId: string,
    body: z.infer<typeof importBody>,
  ) => {
    const current = await store.loadCountry(asCountryId(countryId));
    if (!current) return { kind: "not_found" as const };
    const parsed = parseCurriculumImport(body.format, body.content);
    if (!parsed.ok) return { kind: "invalid" as const, issues: parsed.error };
    const plan = planCurriculumImport(current, parsed.value);
    if (!plan.ok) return { kind: "invalid" as const, issues: plan.error };
    return { kind: "ok" as const, plan: plan.value, country: current.country };
  };

  /** Exercices d'un fichier, notions résolues par code, vérifiés par services/math. */
  const checkExercises = async (countryId: string, content: string) => {
    const current = await store.loadCountry(asCountryId(countryId));
    if (!current) return null;
    const parsed = parseExerciseYaml(content, current.country.code);
    if (!parsed.ok) return { issues: parsed.error, items: [] };
    if (parsed.value.length > MAX_EXERCISES)
      return {
        issues: [
          {
            kind: "parse",
            file: "import",
            message: `au plus ${MAX_EXERCISES} exercices`,
          },
        ],
        items: [],
      };
    const platformId = await platform();
    const exercises = createExerciseStore(deps.db);
    const byCode = new Map(
      current.notions.filter((n) => !n.archived).map((n) => [n.code, n.id]),
    );
    const items: {
      index: number;
      notionCode: string;
      objective: string;
      status:
        | "ok"
        | "unknown_notion"
        | "duplicate"
        | "rejected"
        | "math_unavailable";
      error: string | null;
      notionId: NotionId | null;
    }[] = [];
    for (const [index, seed] of parsed.value.entries()) {
      const base = {
        index,
        notionCode: seed.notionCode,
        objective: seed.objective,
      };
      const notionId = byCode.get(seed.notionCode) ?? null;
      if (!notionId || !platformId) {
        items.push({
          ...base,
          status: "unknown_notion",
          error: null,
          notionId: null,
        });
        continue;
      }
      const existing = await exercises.listIntents({
        organizationIds: [platformId],
        notionId,
      });
      if (existing.some((i) => i.objective === seed.objective)) {
        items.push({ ...base, status: "duplicate", error: null, notionId });
        continue;
      }
      const checked = await validateIntent(seed, deps.math);
      items.push({
        ...base,
        notionId,
        status: checked.ok
          ? "ok"
          : checked.error.kind === "unavailable"
            ? "math_unavailable"
            : "rejected",
        error: checked.ok ? null : checked.error.kind,
      });
    }
    return { issues: [], items, seeds: parsed.value };
  };

  const auditAction = async (
    c: Context<Env>,
    action: string,
    targetId: string,
    details: Record<string, unknown>,
  ) => {
    await createAuditLog(deps.db).append({
      actorId: c.get("user").id,
      organizationId: await platform(),
      action,
      targetType: "country",
      targetId,
      details,
    });
  };

  const exerciseBody = z.object({ content: z.string().max(MAX_IMPORT) });
  const param = zValidator("param", z.object({ id: z.uuid() }));

  return new Hono<Env>()
    .use(requireSession(deps))
    .get(
      "/countries/:id/export",
      requirePermission("curriculum.read"),
      param,
      zValidator(
        "query",
        z.object({ format: z.enum(["yaml", "csv"]).default("yaml") }),
      ),
      async (c) => {
        const current = await store.loadCountry(
          asCountryId(c.req.valid("param").id),
        );
        if (!current) return fail(c, 404, "not_found");
        const { format } = c.req.valid("query");
        const file = `referentiel-${current.country.code.toLowerCase()}.${format}`;
        c.header("content-disposition", `attachment; filename="${file}"`);
        return format === "csv"
          ? c.body(exportNotionsCsv(current), 200, {
              "content-type": "text/csv; charset=utf-8",
            })
          : c.body(exportCurriculumYaml(current), 200, {
              "content-type": "application/yaml; charset=utf-8",
            });
      },
    )
    .post(
      "/countries/:id/import/preview",
      requirePermission("curriculum.write"),
      param,
      zValidator("json", importBody),
      async (c) => {
        const r = await planFor(c.req.valid("param").id, c.req.valid("json"));
        if (r.kind === "not_found") return fail(c, 404, "not_found");
        if (r.kind === "invalid")
          return fail(c, 422, "invalid_import", r.issues);
        return c.json({ summary: r.plan.summary, empty: r.plan.empty }, 200);
      },
    )
    .post(
      "/countries/:id/import/apply",
      requirePermission("curriculum.write"),
      param,
      zValidator("json", importBody),
      async (c) => {
        // Le plan est recalculé : il s'applique à l'état actuel du référentiel.
        const id = c.req.valid("param").id;
        const r = await planFor(id, c.req.valid("json"));
        if (r.kind === "not_found") return fail(c, 404, "not_found");
        if (r.kind === "invalid")
          return fail(c, 422, "invalid_import", r.issues);
        if (!r.plan.empty) {
          await applyCurriculumImport(deps.db, r.country.id, r.plan.changes);
          const s = r.plan.summary;
          await auditAction(c, "curriculum.import", id, {
            format: c.req.valid("json").format,
            grades: s.grades.length,
            programs: s.programs.length,
            units: s.units.length,
            newNotions: s.newNotions,
            updatedNotions: s.updatedNotions.map((u) => u.code),
            misconceptions: s.misconceptions.length,
            prerequisites: s.prerequisites.length,
          });
        }
        return c.json(
          { ok: true, summary: r.plan.summary, empty: r.plan.empty },
          200,
        );
      },
    )
    .post(
      "/countries/:id/exercises/preview",
      param,
      zValidator("json", exerciseBody),
      async (c) => {
        const platformId = await platform();
        if (!platformId || !allowed(c, "exercises.write", platformId))
          return fail(c, 403, "forbidden");
        const r = await checkExercises(
          c.req.valid("param").id,
          c.req.valid("json").content,
        );
        if (!r) return fail(c, 404, "not_found");
        if (r.issues.length > 0)
          return fail(c, 422, "invalid_import", r.issues);
        return c.json(
          { items: r.items.map(({ notionId: _, ...i }) => i) },
          200,
        );
      },
    )
    .post(
      "/countries/:id/exercises/apply",
      param,
      zValidator("json", exerciseBody),
      async (c) => {
        const platformId = await platform();
        if (!platformId || !allowed(c, "exercises.write", platformId))
          return fail(c, 403, "forbidden");
        const id = c.req.valid("param").id;
        const r = await checkExercises(id, c.req.valid("json").content);
        if (!r) return fail(c, 404, "not_found");
        if (r.issues.length > 0 || !r.seeds)
          return fail(c, 422, "invalid_import", r.issues);
        const exercises = createExerciseStore(deps.db);
        let created = 0;
        // Seuls les exercices vérifiés par services/math entrent dans la bibliothèque, déjà validés.
        for (const item of r.items) {
          const seed = r.seeds[item.index];
          if (item.status !== "ok" || !seed || !item.notionId) continue;
          const intent = await exercises.createIntent({
            notionId: item.notionId,
            objective: seed.objective,
            misconceptionId: null,
            statement: seed.statement,
            task: seed.task,
            parameters: seed.parameters,
            constraints: seed.constraints,
            steps: seed.steps,
            expected: seed.expected,
            organizationId: platformId,
            source: "admin",
            createdBy: c.get("user").id,
          });
          if (!intent.ok) continue;
          await exercises.setIntentStatus(intent.value.id, "validated");
          created++;
        }
        await auditAction(c, "exercises.import", id, {
          created,
          total: r.items.length,
        });
        return c.json(
          {
            ok: true,
            created,
            items: r.items.map(({ notionId: _, ...i }) => i),
          },
          200,
        );
      },
    );
}
