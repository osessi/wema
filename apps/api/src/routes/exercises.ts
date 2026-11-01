import { randomUUID } from "node:crypto";
import { zValidator } from "@hono/zod-validator";
import {
  createAuditLog,
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
  type OrganizationId,
  parameterSpecSchema,
} from "@wema/domain";
import {
  type GenerateError,
  generateVariant,
  planVariant,
  seedFrom,
  validateIntent,
} from "@wema/exercises";
import {
  DEFAULT_SETTINGS,
  parseLearnerModelSettings,
  projectLearnerModel,
} from "@wema/learner-model";
import { type Context, Hono } from "hono";
import { z } from "zod";
import type { Deps, Env } from "../context";
import { allowed, fail, requireSession } from "../http";
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
async function learnerModel(db: SqlExecutor, learnerId: LearnerId) {
  const stored = await createSettingsStore(db).get(LEARNER_MODEL_SETTINGS_KEY);
  const parsed = stored === null ? null : parseLearnerModelSettings(stored);
  const settings = parsed?.ok ? parsed.value : DEFAULT_SETTINGS;
  const events = await createEventStore(db).listByLearner(learnerId);
  const model = projectLearnerModel(learnerId, events, settings);
  if (!model.ok) throw new Error(`journal incohérent : ${model.error.kind}`);
  return { model: model.value, settings };
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
        const library = await platform();
        const intents = await exercises.listIntents({
          organizationIds: library
            ? [organizationId, library]
            : [organizationId],
          ...(query.notionId ? { notionId: asNotionId(query.notionId) } : {}),
          ...(query.status ? { status: query.status } : {}),
        });
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
        await deps.db.transaction(async (tx) => {
          await createExerciseStore(tx).setIntentStatus(intent.id, "validated");
          await trace(
            tx,
            c,
            intent.organizationId,
            "exercise.validate",
            intent.id,
          );
        });
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
        }),
      ),
      async (c) => {
        const params = c.req.valid("param");
        const organizationId = asOrganizationId(params.id);
        if (!allowed(c, "exercises.read", organizationId))
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
          seed: seedFrom(`${intent.id}:${Date.now()}`),
          verifier: deps.math,
        });
        if (!variant.ok) return generationFailure(c, variant.error);
        return c.json({ ok: true, variant: variant.value });
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
            if (variant.error.kind === "unavailable")
              return fail(c, 503, "math_unavailable");
            failed.push({ learnerId: id, error: variant.error.kind });
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
        const body = c.req.valid("json");
        const checked = await deps.math.checkAnswer(
          variant.answer,
          body.response,
        );
        if (!checked.ok) return fail(c, 503, "math_unavailable");
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
            misconceptionId: null,
            exerciseRef: variant.id,
            response: body.response,
          },
        });
        if (!appended.ok) throw new Error("identifiant d'événement en conflit");
        // On dit si c'est juste ; la bonne réponse n'est jamais donnée (AGENTS.md, règle 1).
        return c.json({
          ok: true,
          correct: checked.value.correct,
          reason: checked.value.reason,
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
