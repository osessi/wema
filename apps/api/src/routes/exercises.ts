import { randomUUID } from "node:crypto";
import { zValidator } from "@hono/zod-validator";
import type { AiError, AiGateway } from "@wema/ai-gateway";
import {
  createAuditLog,
  createClassStore,
  createCurriculumStore,
  createEventStore,
  createExerciseStore,
  createOrganizationStore,
  createSettingsStore,
  type ExerciseWriteError,
  type IntentContent,
  type SqlExecutor,
} from "@wema/db";
import {
  asEventId,
  asExerciseIntentId,
  asExerciseVariantId,
  asLearnerId,
  asMisconceptionId,
  asNotionId,
  asOrganizationId,
  asUserId,
  type ExerciseIntent,
  exerciseTaskSchema,
  type LearnerId,
  type MisconceptionId,
  type NotionId,
  type NotionStatus,
  type OrganizationId,
  PRESENTATION_FORMATS,
  parameterSpecSchema,
  type UserId,
} from "@wema/domain";
import {
  type GenerateError,
  generateVariant,
  type MathVerifier,
  type NotionDemand,
  planVariant,
  proposeWeeklyBank,
  seedFrom,
  validateIntent,
} from "@wema/exercises";
import {
  DEFAULT_SETTINGS,
  parseLearnerModelSettings,
  projectLearnerModel,
} from "@wema/learner-model";
import { createTutor } from "@wema/tutor";
import { type Context, Hono } from "hono";
import { z } from "zod";
import { accessGuard, subscriptionRequired } from "../billing/access";
import type { Deps, Env } from "../context";
import { allowed, fail, requireSession } from "../http";
import { describeAnswer, notionInfo } from "../tutor-context";
import { collectiveHint } from "./collective";
import { figureOf, renderFormat } from "./formats";
import { LEARNER_MODEL_SETTINGS_KEY } from "./settings";

const uuid = z.uuid();
const line = z.string().trim().min(1).max(1000);
const monday = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((d) => new Date(`${d}T00:00:00Z`).getUTCDay() === 1, {
    message: "la semaine commence un lundi",
  });

const intentContent = z.object({
  notionId: uuid,
  objective: line,
  misconceptionId: uuid.nullable(),
  statement: line,
  task: exerciseTaskSchema,
  parameters: z.array(parameterSpecSchema).max(10),
  constraints: z.array(z.string().min(1).max(300)).max(10),
  steps: z.array(line).max(10),
  expected: z.string().min(1).max(300).nullable(),
});

const toContent = (body: z.infer<typeof intentContent>): IntentContent => ({
  ...body,
  notionId: asNotionId(body.notionId),
  misconceptionId:
    body.misconceptionId === null
      ? null
      : asMisconceptionId(body.misconceptionId),
});

/**
 * Essais permis sur une même variante. Seul le premier compte pour le profil ;
 * les suivants permettent de se corriger, sans chercher la réponse à l'aveugle.
 */
export const MAX_ATTEMPTS_PER_VARIANT = 3;

const writeStatus = (e: ExerciseWriteError) =>
  e.kind === "not_found" ? 404 : 422;

/** Une erreur de génération : services/math indisponible (503) ou exercice incorrect (422). */
function generationFailure(
  c: Context,
  error: GenerateError & { level?: number },
) {
  return error.kind === "unavailable"
    ? fail(c, 503, "math_unavailable")
    : fail(c, 422, "exercise_invalid", error);
}

/** Profil d'un élève, recalculé depuis son journal avec les réglages pédagogiques en vigueur. */
export async function learnerModel(db: SqlExecutor, learnerId: LearnerId) {
  const stored = await createSettingsStore(db).get(LEARNER_MODEL_SETTINGS_KEY);
  const parsed = stored === null ? null : parseLearnerModelSettings(stored);
  const settings = parsed?.ok ? parsed.value : DEFAULT_SETTINGS;
  const events = await createEventStore(db).listByLearner(learnerId);
  const model = projectLearnerModel(learnerId, events, settings);
  if (!model.ok) throw new Error(`journal incohérent : ${model.error.kind}`);
  return { model: model.value, settings, events };
}

/** Lundi de la semaine d'une date, AAAA-MM-JJ (UTC). */
export function weekOf(date: Date): string {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/**
 * Ce que les classes d'une organisation font de chaque notion de leurs
 * programmes : statuts des élèves (profil recalculé depuis le journal),
 * idées fausses actives, et ce que la banque de la semaine contient déjà.
 * Le choix des notions et des exercices revient ensuite au cœur.
 */
export async function bankDemands(
  db: SqlExecutor,
  organizationId: OrganizationId,
  week: string,
): Promise<NotionDemand[]> {
  const classStore = createClassStore(db);
  const curriculum = createCurriculumStore(db);
  const exercises = createExerciseStore(db);
  const classes = (await classStore.listClasses(organizationId)).filter(
    (k) => k.programId !== null,
  );
  const demands = new Map<
    NotionId,
    NotionDemand & { learners: Map<string, NotionStatus> }
  >();
  const models = new Map<string, Awaited<ReturnType<typeof learnerModel>>>();
  let rank = 0;
  for (const k of classes) {
    if (!k.programId) continue;
    const countryId = await curriculum.countryOfProgram(k.programId);
    const rows = countryId ? await curriculum.loadCountry(countryId) : null;
    const program = rows?.programs.find((p) => p.id === k.programId);
    if (!rows || !program) continue;
    const context = [
      rows.country.name,
      rows.grades.find((g) => g.id === program.gradeId)?.name,
      rows.subjects.find((s) => s.id === program.subjectId)?.name,
    ]
      .filter(Boolean)
      .join(" · ");
    const units = rows.units
      .filter((u) => u.programId === program.id && !u.archived)
      .sort((a, b) => a.position - b.position);
    const notions = units.flatMap((u) =>
      rows.notions
        .filter((n) => n.unitId === u.id && !n.archived)
        .sort((a, b) => a.position - b.position),
    );
    const learners = (await classStore.listMembers(k.id)).filter(
      (m) => m.role === "learner",
    );
    for (const n of notions) {
      let d = demands.get(n.id);
      if (!d) {
        d = {
          notionId: n.id,
          name: n.name,
          description: n.description,
          context,
          position: rank++,
          counts: { not_seen: 0, needs_work: 0, in_progress: 0, mastered: 0 },
          misconceptions: n.misconceptions
            .filter((m) => !m.archived)
            .map((m) => ({
              id: m.id,
              description: m.description,
              learners: 0,
            })),
          alreadyProposed: 0,
          existingObjectives: [],
          learners: new Map(),
        };
        demands.set(n.id, d);
      }
      for (const m of learners) {
        // Un élève inscrit dans deux classes du même programme ne compte qu'une fois.
        if (d.learners.has(m.userId)) continue;
        let profile = models.get(m.userId);
        if (!profile) {
          profile = await learnerModel(db, asLearnerId(m.userId));
          models.set(m.userId, profile);
        }
        const state = profile.model.notions[n.id];
        const status: NotionStatus = state?.status ?? "not_seen";
        d.learners.set(m.userId, status);
        d.counts[status]++;
        const active = new Set(
          state?.misconceptions
            .filter((x) => x.active)
            .map((x) => x.misconceptionId) ?? [],
        );
        d.misconceptions = d.misconceptions.map((x) =>
          active.has(x.id) ? { ...x, learners: x.learners + 1 } : x,
        );
      }
    }
  }
  for (const entry of await exercises.listBank({ organizationId, week })) {
    const d = demands.get(entry.notionId);
    if (!d) continue;
    const intent = await exercises.getIntent(entry.intentId);
    if (!intent) continue;
    if (entry.status !== "rejected")
      d.existingObjectives = [...d.existingObjectives, intent.objective];
    if (intent.source === "ai" && entry.status !== "rejected")
      d.alreadyProposed++;
  }
  return [...demands.values()].map(({ learners: _, ...d }) => d);
}

const aiErrorCode = (e: AiError) =>
  e.kind === "misconfigured" ? "ai_not_configured" : "ai_unavailable";

/**
 * Demande à l'IA les propositions de la semaine pour une organisation, et
 * enregistre dans la banque celles que services/math a vérifiées (source « ai »,
 * validées, à trier par le prof).
 */
export async function generateBank(
  deps: { db: SqlExecutor; ai: AiGateway; math: MathVerifier },
  input: {
    organizationId: OrganizationId;
    week: string;
    actorId: UserId | null;
  },
) {
  const { organizationId, week, actorId } = input;
  const demands = await bankDemands(deps.db, organizationId, week);
  const results = await proposeWeeklyBank({
    ai: deps.ai,
    verifier: deps.math,
    demands,
    context: { organizationId, learnerId: null },
    seed: seedFrom(`${organizationId}:${week}`),
  });
  const proposed: {
    entryId: string;
    intentId: string;
    notionId: string;
    notionName: string;
    objective: string;
    sample: string | null;
  }[] = [];
  const rejected: {
    notionId: string;
    notionName: string;
    objective: string | null;
    reason: string;
    detail: string | null;
  }[] = [];
  const failed: { notionId: string; notionName: string; error: string }[] = [];
  for (const r of results) {
    const notion = { notionId: r.notion.notionId, notionName: r.notion.name };
    if (r.error) failed.push({ ...notion, error: aiErrorCode(r.error) });
    for (const x of r.rejected) rejected.push({ ...notion, ...x });
    for (const intent of r.accepted) {
      const saved = await deps.db.transaction(async (tx) => {
        const store = createExerciseStore(tx);
        const { samples, ...content } = intent;
        const created = await store.createIntent({
          ...content,
          organizationId,
          source: "ai",
          createdBy: actorId,
        });
        if (!created.ok) return null;
        // Vérifiée à chaque niveau par services/math : elle entre validée.
        const validated = await store.markValidated(created.value);
        if (!validated.ok) return null;
        const entry = await store.proposeForWeek({
          organizationId,
          week,
          intent: validated.value,
          proposedBy: actorId,
        });
        if (!entry.ok) return null;
        const audit = createAuditLog(tx);
        await audit.append({
          actorId,
          organizationId,
          action: "exercise.create",
          targetType: "exercise",
          targetId: created.value.id,
          details: { source: "ai" },
        });
        await audit.append({
          actorId,
          organizationId,
          action: "bank.propose",
          targetType: "exercise",
          targetId: entry.value,
          details: { week, intentId: created.value.id, source: "ai" },
        });
        return { entryId: entry.value, intentId: created.value.id };
      });
      if (saved)
        proposed.push({
          ...saved,
          ...notion,
          objective: intent.objective,
          sample: intent.samples[0] ?? null,
        });
      else
        rejected.push({
          ...notion,
          objective: intent.objective,
          reason: "invalid_reference",
          detail: null,
        });
    }
  }
  return { week, notions: results.length, proposed, rejected, failed };
}

/** Réglage qui retient la dernière semaine préparée automatiquement pour une organisation. */
const autoBankKey = (organizationId: OrganizationId) =>
  `exercise_bank_auto:${organizationId}`;

/**
 * Passage automatique : chaque semaine, une fois, les propositions de l'IA
 * pour chaque organisation qui a des classes avec un programme. La semaine
 * est notée avant l'appel, pour qu'un échec ne relance pas l'IA toutes les heures.
 */
export async function runWeeklyBank(
  deps: { db: SqlExecutor; ai: AiGateway; math: MathVerifier },
  now: Date,
) {
  const week = weekOf(now);
  const settings = createSettingsStore(deps.db);
  const classStore = createClassStore(deps.db);
  let proposed = 0;
  let organizations = 0;
  for (const org of await createOrganizationStore(
    deps.db,
  ).listOrganizations()) {
    const classes = await classStore.listClasses(org.id);
    if (!classes.some((k) => k.programId !== null)) continue;
    const done = await settings.get(autoBankKey(org.id));
    if (done === week) continue;
    await settings.set(autoBankKey(org.id), week, null);
    const result = await generateBank(deps, {
      organizationId: org.id,
      week,
      actorId: null,
    });
    organizations++;
    proposed += result.proposed.length;
  }
  return { week, organizations, proposed };
}

export function exerciseRoutes(deps: Deps) {
  const exercises = createExerciseStore(deps.db);
  const organizations = createOrganizationStore(deps.db);

  let platformId: OrganizationId | null = null;
  const platform = async () => {
    platformId ??= (await organizations.getPlatformOrganization())?.id ?? null;
    return platformId;
  };

  /** Une intention est visible par son organisation et, si elle est de la bibliothèque Wema, par toutes. */
  const visibleTo = async (
    intent: ExerciseIntent,
    organizationId: OrganizationId,
  ) =>
    intent.organizationId === organizationId ||
    intent.organizationId === (await platform());

  const trace = (
    tx: SqlExecutor,
    c: Context<Env>,
    organizationId: OrganizationId,
    action: string,
    targetId: string,
    details: Record<string, unknown> = {},
  ) =>
    createAuditLog(tx).append({
      actorId: c.get("user").id,
      organizationId,
      action,
      targetType: "exercise",
      targetId,
      details,
    });

  /** Intention modifiable par l'acteur : il faut exercises.write dans l'organisation propriétaire. */
  const writable = async (c: Context<Env>, id: string) => {
    const intent = await exercises.getIntent(asExerciseIntentId(id));
    if (!intent) return null;
    return allowed(c, "exercises.write", intent.organizationId)
      ? intent
      : "forbidden";
  };

  return new Hono<Env>()
    .use(requireSession(deps))
    .get(
      "/organizations/:id/exercises",
      zValidator("param", z.object({ id: uuid })),
      zValidator(
        "query",
        z.object({
          notionId: uuid.optional(),
          status: z.enum(["draft", "validated", "archived"]).optional(),
        }),
      ),
      async (c) => {
        const organizationId = asOrganizationId(c.req.valid("param").id);
        if (!allowed(c, "exercises.read", organizationId))
          return fail(c, 403, "forbidden");
        const query = c.req.valid("query");
        const filters = {
          ...(query.notionId ? { notionId: asNotionId(query.notionId) } : {}),
          ...(query.status ? { status: query.status } : {}),
        };
        const library = await platform();
        const own = await exercises.listIntents({
          organizationIds: [organizationId],
          ...filters,
        });
        // De la bibliothèque Wema, une autre organisation ne voit que les exercices validés.
        const shared =
          library &&
          library !== organizationId &&
          (query.status ?? "validated") === "validated"
            ? await exercises.listIntents({
                organizationIds: [library],
                ...filters,
                status: "validated",
              })
            : [];
        // La réponse annoncée par l'auteur n'est montrée qu'à ceux qui peuvent écrire des exercices.
        const canWrite = allowed(c, "exercises.write", organizationId);
        const intents = [...own, ...shared].map((i) =>
          canWrite ? i : { ...i, expected: null },
        );
        return c.json({ exercises: intents }, 200);
      },
    )
    .post(
      "/organizations/:id/exercises",
      zValidator("param", z.object({ id: uuid })),
      zValidator("json", intentContent),
      async (c) => {
        const organizationId = asOrganizationId(c.req.valid("param").id);
        if (!allowed(c, "exercises.write", organizationId))
          return fail(c, 403, "forbidden");
        const content = toContent(c.req.valid("json"));
        const source =
          organizationId === (await platform()) ? "admin" : "teacher";
        const created = await deps.db.transaction(async (tx) => {
          const result = await createExerciseStore(tx).createIntent({
            ...content,
            organizationId,
            source,
            createdBy: c.get("user").id,
          });
          if (result.ok)
            await trace(
              tx,
              c,
              organizationId,
              "exercise.create",
              result.value.id,
            );
          return result;
        });
        if (!created.ok)
          return fail(c, writeStatus(created.error), created.error.kind);
        return c.json({ ok: true, id: created.value.id }, 201);
      },
    )
    .patch(
      "/exercises/:id",
      zValidator("param", z.object({ id: uuid })),
      zValidator("json", intentContent),
      async (c) => {
        const intent = await writable(c, c.req.valid("param").id);
        if (!intent) return fail(c, 404, "not_found");
        if (intent === "forbidden") return fail(c, 403, "forbidden");
        const content = toContent(c.req.valid("json"));
        const updated = await deps.db.transaction(async (tx) => {
          const result = await createExerciseStore(tx).updateIntent(
            intent.id,
            content,
          );
          if (result.ok)
            await trace(
              tx,
              c,
              intent.organizationId,
              "exercise.update",
              intent.id,
            );
          return result;
        });
        if (!updated.ok)
          return fail(c, writeStatus(updated.error), updated.error.kind);
        return c.json({ ok: true, id: intent.id });
      },
    )
    .post(
      "/exercises/:id/validate",
      zValidator("param", z.object({ id: uuid })),
      async (c) => {
        const intent = await writable(c, c.req.valid("param").id);
        if (!intent) return fail(c, 404, "not_found");
        if (intent === "forbidden") return fail(c, 403, "forbidden");
        // Un exercice n'est proposé aux élèves qu'après une variante vérifiée à chaque niveau.
        const samples = await validateIntent(intent, deps.math);
        if (!samples.ok) return generationFailure(c, samples.error);
        const marked = await deps.db.transaction(async (tx) => {
          // Seulement si l'exercice n'a pas été modifié pendant la vérification.
          const result = await createExerciseStore(tx).markValidated(intent);
          if (result.ok)
            await trace(
              tx,
              c,
              intent.organizationId,
              "exercise.validate",
              intent.id,
            );
          return result;
        });
        if (!marked.ok) return fail(c, 409, "exercise_changed");
        return c.json({
          ok: true,
          samples: samples.value.map((s) => ({
            level: s.level,
            statement: s.statement,
          })),
        });
      },
    )
    .post(
      "/exercises/:id/archive",
      zValidator("param", z.object({ id: uuid })),
      async (c) => {
        const intent = await writable(c, c.req.valid("param").id);
        if (!intent) return fail(c, 404, "not_found");
        if (intent === "forbidden") return fail(c, 403, "forbidden");
        await deps.db.transaction(async (tx) => {
          await createExerciseStore(tx).setIntentStatus(intent.id, "archived");
          await trace(
            tx,
            c,
            intent.organizationId,
            "exercise.archive",
            intent.id,
          );
        });
        return c.json({ ok: true, id: intent.id });
      },
    )
    .post(
      "/organizations/:id/exercises/:intentId/preview",
      zValidator("param", z.object({ id: uuid, intentId: uuid })),
      zValidator(
        "json",
        z.object({
          level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
          scaffolded: z.boolean(),
          /** Graine d'un aperçu précédent : la même variante, pour la voir dans un autre format. */
          seed: z.number().int().min(0).max(4_294_967_295).optional(),
          format: z.enum(["comics", "easy_reading"]).optional(),
        }),
      ),
      async (c) => {
        const params = c.req.valid("param");
        const organizationId = asOrganizationId(params.id);
        if (!allowed(c, "exercises.write", organizationId))
          return fail(c, 403, "forbidden");
        const intent = await exercises.getIntent(
          asExerciseIntentId(params.intentId),
        );
        if (!intent || !(await visibleTo(intent, organizationId)))
          return fail(c, 404, "not_found");
        const body = c.req.valid("json");
        const variant = await generateVariant({
          intent,
          plan: {
            level: body.level,
            scaffolded: body.scaffolded,
            hintLevel: 0,
          },
          seed: body.seed ?? seedFrom(`${intent.id}:${Date.now()}`),
          verifier: deps.math,
        });
        if (!variant.ok) return generationFailure(c, variant.error);
        // Formats adaptés : figure toujours, reformulation par l'IA sur demande (sans cache).
        const rendering = body.format
          ? await renderFormat(deps, {
              format: body.format,
              variant: variant.value,
              variantId: null,
              learnerId: null,
              organizationId,
            })
          : null;
        return c.json({
          ok: true,
          variant: variant.value,
          ...figureOf(intent.task, variant.value),
          rendering,
        });
      },
    )
    .get(
      "/organizations/:id/bank",
      zValidator("param", z.object({ id: uuid })),
      zValidator(
        "query",
        z.object({ week: monday, notionId: uuid.optional() }),
      ),
      async (c) => {
        const organizationId = asOrganizationId(c.req.valid("param").id);
        if (!allowed(c, "exercises.read", organizationId))
          return fail(c, 403, "forbidden");
        const query = c.req.valid("query");
        const entries = await exercises.listBank({
          organizationId,
          week: query.week,
          ...(query.notionId ? { notionId: asNotionId(query.notionId) } : {}),
        });
        return c.json({ entries }, 200);
      },
    )
    .post(
      "/organizations/:id/bank",
      zValidator("param", z.object({ id: uuid })),
      zValidator("json", z.object({ week: monday, intentId: uuid })),
      async (c) => {
        const organizationId = asOrganizationId(c.req.valid("param").id);
        if (!allowed(c, "exercises.write", organizationId))
          return fail(c, 403, "forbidden");
        const body = c.req.valid("json");
        const intent = await exercises.getIntent(
          asExerciseIntentId(body.intentId),
        );
        if (!intent || !(await visibleTo(intent, organizationId)))
          return fail(c, 404, "not_found");
        if (intent.status !== "validated")
          return fail(c, 422, "exercise_not_validated");
        const proposed = await deps.db.transaction(async (tx) => {
          const result = await createExerciseStore(tx).proposeForWeek({
            organizationId,
            week: body.week,
            intent,
            proposedBy: c.get("user").id,
          });
          if (result.ok)
            await trace(
              tx,
              c,
              organizationId,
              "bank.propose",
              result.value,
              body,
            );
          return result;
        });
        if (!proposed.ok)
          return fail(c, writeStatus(proposed.error), proposed.error.kind);
        return c.json({ ok: true, id: proposed.value }, 201);
      },
    )
    .post(
      "/organizations/:id/bank/generate",
      zValidator("param", z.object({ id: uuid })),
      zValidator("json", z.object({ week: monday })),
      async (c) => {
        const organizationId = asOrganizationId(c.req.valid("param").id);
        if (!allowed(c, "exercises.write", organizationId))
          return fail(c, 403, "forbidden");
        if (!deps.aiConfigured) return fail(c, 503, "ai_not_configured");
        const result = await generateBank(deps, {
          organizationId,
          week: c.req.valid("json").week,
          actorId: c.get("user").id,
        });
        // L'IA n'a répondu pour aucune notion : erreur franche plutôt qu'un résultat vide.
        const first = result.failed[0];
        if (first && result.failed.length === result.notions)
          return fail(c, 503, first.error);
        return c.json({ ok: true, ...result });
      },
    )
    .patch(
      "/organizations/:id/bank/:entryId",
      zValidator("param", z.object({ id: uuid, entryId: uuid })),
      zValidator(
        "json",
        z.object({ status: z.enum(["selected", "rejected"]) }),
      ),
      async (c) => {
        const params = c.req.valid("param");
        const organizationId = asOrganizationId(params.id);
        if (!allowed(c, "exercises.write", organizationId))
          return fail(c, 403, "forbidden");
        const status = c.req.valid("json").status;
        const decided = await deps.db.transaction(async (tx) => {
          const result = await createExerciseStore(tx).decideBankEntry({
            id: params.entryId,
            organizationId,
            status,
            decidedBy: c.get("user").id,
          });
          if (result.ok)
            await trace(
              tx,
              c,
              organizationId,
              `bank.${status}`,
              params.entryId,
            );
          return result;
        });
        if (!decided.ok)
          return fail(c, writeStatus(decided.error), decided.error.kind);
        return c.json({ ok: true, id: params.entryId });
      },
    )
    .post(
      "/organizations/:id/exercises/:intentId/variants",
      zValidator("param", z.object({ id: uuid, intentId: uuid })),
      zValidator(
        "json",
        z.object({ learnerIds: z.array(uuid).min(1).max(100) }),
      ),
      async (c) => {
        const params = c.req.valid("param");
        const organizationId = asOrganizationId(params.id);
        if (!allowed(c, "exercises.write", organizationId))
          return fail(c, 403, "forbidden");
        const intent = await exercises.getIntent(
          asExerciseIntentId(params.intentId),
        );
        if (!intent || !(await visibleTo(intent, organizationId)))
          return fail(c, 404, "not_found");
        if (intent.status !== "validated")
          return fail(c, 422, "exercise_not_validated");

        const created: {
          learnerId: string;
          variantId: string;
          level: number;
          scaffolded: boolean;
        }[] = [];
        const failed: { learnerId: string; error: string }[] = [];
        for (const id of new Set(c.req.valid("json").learnerIds)) {
          const userId = asUserId(id);
          // Une organisation ne prépare des exercices que pour ses propres membres.
          if (!(await organizations.isMember(organizationId, userId))) {
            failed.push({ learnerId: id, error: "not_member" });
            continue;
          }
          const learnerId = asLearnerId(id);
          const { model, settings } = await learnerModel(deps.db, learnerId);
          const plan = planVariant(
            intent,
            model.notions[intent.notionId],
            settings,
            await collectiveHint(deps.db, intent.notionId),
          );
          const variant = await generateVariant({
            intent,
            plan,
            seed: seedFrom(
              `${learnerId}:${intent.id}:${model.eventCount}:${Date.now()}`,
            ),
            verifier: deps.math,
          });
          if (!variant.ok) {
            // services/math indisponible : on le signale pour cet élève, les variantes
            // déjà créées restent valables.
            failed.push({
              learnerId: id,
              error:
                variant.error.kind === "unavailable"
                  ? "math_unavailable"
                  : variant.error.kind,
            });
            continue;
          }
          const v = variant.value;
          const saved = await deps.db.transaction(async (tx) => {
            const row = await createExerciseStore(tx).createVariant({
              intentId: intent.id,
              learnerId,
              seed: v.seed,
              plan: {
                level: v.level,
                scaffolded: v.scaffolded,
                hintLevel: v.hintLevel,
              },
              parameters: v.parameters,
              statement: v.statement,
              rendered: v.rendered,
              steps: v.steps,
              answer: v.answer,
              verifiedAt: new Date(),
            });
            await trace(tx, c, organizationId, "variant.create", row.id, {
              intentId: intent.id,
              learnerId,
            });
            return row;
          });
          created.push({
            learnerId: id,
            variantId: saved.id,
            level: v.level,
            scaffolded: v.scaffolded,
          });
        }
        return c.json({ ok: true, created, failed });
      },
    );
}

/** Espace de l'élève connecté : ses variantes, ses réponses, sa progression. */
export function learnerRoutes(deps: Deps) {
  const exercises = createExerciseStore(deps.db);
  return new Hono<Env>()
    .use(requireSession(deps))
    .get("/variants", async (c) => {
      const learnerId = asLearnerId(c.get("user").id);
      const variants = await exercises.listVariantsForLearner(learnerId);
      // La réponse attendue ne quitte jamais le serveur.
      return c.json(
        {
          variants: variants.map((v) => ({
            id: v.id,
            statement: v.statement,
            rendered: v.rendered,
            steps: v.steps,
            level: v.level,
            scaffolded: v.scaffolded,
            hintLevel: v.hintLevel,
          })),
        },
        200,
      );
    })
    .post(
      "/variants/:id/answer",
      zValidator("param", z.object({ id: uuid })),
      zValidator(
        "json",
        z.object({
          response: z.string().min(1).max(200),
          hintsUsed: z.number().int().min(0).max(10),
          /** Format dans lequel l'élève lisait l'énoncé (mesure de ce qui marche). */
          format: z.enum(PRESENTATION_FORMATS).optional(),
        }),
      ),
      async (c) => {
        const learnerId = asLearnerId(c.get("user").id);
        const variant = await exercises.getVariant(
          asExerciseVariantId(c.req.valid("param").id),
        );
        if (!variant || variant.learnerId !== learnerId)
          return fail(c, 404, "not_found");
        const intent = await exercises.getIntent(variant.intentId);
        if (!intent) return fail(c, 404, "not_found");
        // Exercices personnalisés : matière ouverte (abonnement, essai ou contrat).
        if (
          !(await accessGuard(
            deps.db,
            deps.billing.access,
            learnerId,
            deps.now(),
          ).notion(intent.notionId))
        )
          return subscriptionRequired(c);
        const body = c.req.valid("json");
        if (
          (await exercises.countAttempts(variant.id, learnerId)) >=
          MAX_ATTEMPTS_PER_VARIANT
        ) {
          return fail(c, 409, "attempts_exhausted");
        }
        const checked = await deps.math.checkAnswer(
          variant.answer,
          body.response,
        );
        if (!checked.ok) return fail(c, 503, "math_unavailable");
        // Une réponse illisible (faute de frappe, unité) n'est ni une erreur ni un essai :
        // on invite l'élève à la réécrire.
        if (
          checked.value.reason === "invalid_input" ||
          checked.value.reason === "too_complex"
        ) {
          return fail(c, 422, "unreadable_answer");
        }
        const attempt = await exercises.recordAttempt({
          variantId: variant.id,
          learnerId,
          correct: checked.value.correct,
        });
        if (attempt > MAX_ATTEMPTS_PER_VARIANT)
          return fail(c, 409, "attempts_exhausted");
        // Seul le premier essai entre dans le journal : refaire la même variante
        // n'apporte pas de nouvelle preuve de maîtrise.
        if (attempt === 1) {
          // Réponse fausse : l'IA cherche l'idée fausse qui l'explique (avec un seuil de
          // confiance). Si elle ne répond pas, la réponse compte quand même, sans idée fausse.
          let misconceptionId: MisconceptionId | null = null;
          let misconceptionConfidence: number | null = null;
          if (!checked.value.correct) {
            const info = await notionInfo(deps.db, intent.notionId);
            if (info && info.misconceptions.length > 0) {
              const analysis = await createTutor(deps.ai).analyzeWrongAnswer({
                statement: variant.statement,
                response: body.response,
                expected: describeAnswer(variant.answer),
                misconceptions: info.misconceptions,
                context: { organizationId: null, learnerId },
              });
              if (analysis.ok && analysis.value) {
                misconceptionId = analysis.value.misconceptionId;
                misconceptionConfidence = analysis.value.confidence;
              }
            }
          }
          const appended = await createEventStore(deps.db).append({
            id: asEventId(randomUUID()),
            learnerId,
            // Heure du serveur : un appareil mal réglé ne peut pas dater une réponse dans le futur.
            occurredAt: deps.now(),
            source: "web",
            payload: {
              type: "answer.submitted",
              notionId: intent.notionId,
              correct: checked.value.correct,
              hintsUsed: body.hintsUsed,
              misconceptionId,
              exerciseRef: variant.id,
              response: body.response,
              scaffolded: variant.scaffolded,
              format: body.format ?? null,
              // L'idée fausse vient de l'IA : sa confiance pèse dans le profil (règle n°4).
              misconceptionSource: misconceptionId ? "ai" : null,
              misconceptionConfidence,
            },
          });
          if (!appended.ok)
            throw new Error("identifiant d'événement en conflit");
        }
        // On dit si c'est juste ; la bonne réponse n'est jamais donnée (AGENTS.md, règle 1).
        return c.json({
          ok: true,
          correct: checked.value.correct,
          reason: checked.value.reason,
          attemptsLeft: MAX_ATTEMPTS_PER_VARIANT - attempt,
        });
      },
    )
    .get("/progress", async (c) => {
      const learnerId = asLearnerId(c.get("user").id);
      const { model } = await learnerModel(deps.db, learnerId);
      const notions = Object.values(model.notions).map((n) => ({
        notionId: n.notionId,
        status: n.status,
        pKnown: n.pKnown,
        observations: n.observations,
        activeMisconceptions: n.misconceptions
          .filter((m) => m.active)
          .map((m) => m.misconceptionId),
      }));
      return c.json({ notions }, 200);
    });
}
