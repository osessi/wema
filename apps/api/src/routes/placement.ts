import { randomUUID } from "node:crypto";
import { zValidator } from "@hono/zod-validator";
import {
  createAccountStore,
  createEventStore,
  createExerciseStore,
  createOrganizationStore,
  createPlacementStore,
  type LearnerProgram,
  type PlacementTest,
} from "@wema/db";
import {
  asEventId,
  asLearnerId,
  asSubjectId,
  asUserId,
  type LearnerId,
  type NotionStatus,
  type OrganizationId,
} from "@wema/domain";
import { generateVariant, seedFrom } from "@wema/exercises";
import {
  nextPlacementNotion,
  PLACEMENT_PLAN,
  type PlacementNotion,
  placementAvailableAt,
  placementEstimates,
  placementIntents,
  placementProgress,
  placementScope,
} from "@wema/orchestrator";
import { Hono } from "hono";
import { z } from "zod";
import type { Deps, Env } from "../context";
import { createCurriculumCache, followedPrograms } from "../followup";
import { fail, requireSession } from "../http";
import { learnerModel } from "./exercises";

/**
 * Test de niveau (positionnement), avant le paiement : il ne demande pas que
 * la matière soit ouverte (pas de contrôle d'abonnement ici), mais il n'ouvre
 * que lui-même. Les questions ne sont pas des variantes d'exercice : elles ne
 * donnent accès ni au prof IA ni aux exercices. Un seul test complet par
 * matière et par période (`PLACEMENT_COOLDOWN_DAYS`). Le choix des questions
 * et l'estimation viennent du cœur (@wema/orchestrator) ; chaque réponse
 * entre au journal, et le profil en est recalculé.
 */
export function placementRoutes(deps: Deps) {
  // Une seule réponse (ou préparation de question) à la fois par élève.
  const busy = new Set<string>();
  const subjectParam = zValidator("param", z.object({ subjectId: z.uuid() }));

  /** Programme suivi dans la matière, notions du test et notions qui ont une question. */
  async function contextOf(learnerId: LearnerId, program: LearnerProgram) {
    const cache = createCurriculumCache(deps.db);
    const programNotions = await cache.programNotions(program.programId);
    const known = new Map<string, PlacementNotion>(
      cache
        .loaded()
        .filter((n) => !n.archived)
        .map((n) => [n.id, { id: n.id, prerequisites: n.prerequisites }]),
    );
    const scope = placementScope(
      programNotions.map((n) => ({ id: n.id, prerequisites: n.prerequisites })),
      known,
    );
    const inScope = new Set(scope.map((n) => n.id));
    const platform = await createOrganizationStore(
      deps.db,
    ).getPlatformOrganization();
    const memberships = await createAccountStore(deps.db).listMemberships(
      asUserId(learnerId),
    );
    const organizationIds: OrganizationId[] = [
      ...new Set([
        ...(platform ? [platform.id] : []),
        ...(program.source === "individual" ? [program.organizationId] : []),
        ...memberships.map((m) => m.organizationId),
      ]),
    ];
    const intents = (
      await createExerciseStore(deps.db).listIntents({
        organizationIds,
        status: "validated",
      })
    ).filter((i) => inScope.has(i.notionId));
    const askable = new Set<string>(intents.map((i) => i.notionId));
    const names = new Map(cache.loaded().map((n) => [n.id, n.name]));
    return {
      scope,
      askable,
      intents,
      names,
      inProgram: new Set<string>(programNotions.map((n) => n.id)),
    };
  }

  async function programOf(learnerId: LearnerId, subjectId: string) {
    return (await followedPrograms(deps.db, learnerId)).find(
      (p) => p.subjectId === subjectId,
    );
  }

  const answersOf = (
    items: Awaited<
      ReturnType<ReturnType<typeof createPlacementStore>["items"]>
    >,
  ) =>
    items.flatMap((i) =>
      i.correct === null ? [] : [{ notionId: i.notionId, correct: i.correct }],
    );

  const lastCompleted = (tests: readonly PlacementTest[]) =>
    tests.find((t) => t.completedAt !== null)?.completedAt ?? null;

  return (
    new Hono<Env>()
      .use(requireSession(deps))
      // Où en est le test dans chaque matière suivie (pour l'accueil et l'onboarding).
      .get("/", async (c) => {
        const learnerId = asLearnerId(c.get("user").id);
        const now = deps.now();
        const tests = await createPlacementStore(deps.db).list(learnerId);
        const subjects = [];
        for (const p of await followedPrograms(deps.db, learnerId)) {
          const mine = tests.filter((t) => t.subjectId === p.subjectId);
          const open = mine.find((t) => t.completedAt === null);
          const completedAt = lastCompleted(mine);
          const { askable } = await contextOf(learnerId, p);
          subjects.push({
            subjectId: p.subjectId,
            subjectName: p.subjectName,
            subjectIcon: p.subjectIcon,
            programName: `${p.subjectName} · ${p.gradeName}`,
            state: open
              ? ("in_progress" as const)
              : completedAt
                ? ("done" as const)
                : ("not_started" as const),
            completedAt: completedAt?.toISOString() ?? null,
            availableAt:
              placementAvailableAt(completedAt, now)?.toISOString() ?? null,
            hasQuestions: askable.size > 0,
          });
        }
        return c.json({ subjects }, 200);
      })
      .post("/:subjectId/start", subjectParam, async (c) => {
        const learnerId = asLearnerId(c.get("user").id);
        const subjectId = asSubjectId(c.req.valid("param").subjectId);
        const program = await programOf(learnerId, subjectId);
        if (!program) return fail(c, 404, "no_program");
        const store = createPlacementStore(deps.db);
        const tests = await store.list(learnerId, subjectId);
        const now = deps.now();
        if (!tests.some((t) => t.completedAt === null)) {
          const availableAt = placementAvailableAt(lastCompleted(tests), now);
          if (availableAt)
            return fail(c, 409, "placement_cooldown", {
              availableAt: availableAt.toISOString(),
            });
          const { askable } = await contextOf(learnerId, program);
          if (askable.size === 0) return fail(c, 422, "no_questions");
        }
        const test = await store.open({
          learnerId,
          subjectId,
          programId: program.programId,
          now,
        });
        return c.json({ ok: true, testId: test.id }, 200);
      })
      // Question en cours, ou la suivante (préparée et vérifiée par services/math).
      .get("/:subjectId/question", subjectParam, async (c) => {
        const learnerId = asLearnerId(c.get("user").id);
        const subjectId = asSubjectId(c.req.valid("param").subjectId);
        const program = await programOf(learnerId, subjectId);
        if (!program) return fail(c, 404, "no_program");
        const store = createPlacementStore(deps.db);
        const test = (await store.list(learnerId, subjectId)).find(
          (t) => t.completedAt === null,
        );
        if (!test) return fail(c, 409, "placement_not_started");
        if (busy.has(learnerId)) return fail(c, 429, "slow_down");
        busy.add(learnerId);
        try {
          const ctx = await contextOf(learnerId, program);
          const skipped = new Set<string>(test.skippedNotions);
          // Au plus une tentative par notion encore possible : la boucle finit toujours.
          for (let guard = 0; guard <= ctx.scope.length; guard++) {
            const items = await store.items(test.id);
            const answers = answersOf(items);
            const progress = placementProgress({
              scope: ctx.scope,
              askable: ctx.askable,
              answered: answers.length,
            });
            const pending = items.find((i) => i.answeredAt === null);
            if (pending)
              return c.json(
                {
                  done: false as const,
                  progress,
                  question: {
                    id: pending.id,
                    statement: pending.statement,
                    rendered: pending.rendered,
                  },
                },
                200,
              );
            const notionId = nextPlacementNotion({
              scope: ctx.scope,
              askable: ctx.askable,
              answers,
              skipped,
            });
            if (!notionId) {
              await store.complete(test.id, deps.now());
              return c.json({ done: true as const, progress }, 200);
            }
            let created = false;
            for (const intent of placementIntents(ctx.intents, notionId)) {
              const variant = await generateVariant({
                intent,
                plan: PLACEMENT_PLAN,
                seed: seedFrom(
                  `${learnerId}:${intent.id}:${test.id}:placement`,
                ),
                verifier: deps.math,
              });
              if (!variant.ok) {
                if (variant.error.kind === "unavailable")
                  return fail(c, 503, "math_unavailable");
                continue;
              }
              await store.addItem({
                testId: test.id,
                position: items.length,
                notionId,
                intentId: intent.id,
                statement: variant.value.statement,
                rendered: variant.value.rendered,
                answer: variant.value.answer,
              });
              created = true;
              break;
            }
            if (!created) {
              // Aucun exercice de la notion ne se décline : on l'écarte de ce test.
              await store.skipNotion(test.id, notionId);
              skipped.add(notionId);
            }
          }
          throw new Error("test de niveau : aucune question préparée");
        } finally {
          busy.delete(learnerId);
        }
      })
      // Réponse à la question en cours. On ne dit jamais si elle est juste.
      .post(
        "/:subjectId/answer",
        subjectParam,
        zValidator(
          "json",
          z.object({
            itemId: z.uuid(),
            /** null : « Je ne sais pas » (compté comme une erreur, sans réponse). */
            response: z.string().trim().min(1).max(200).nullable(),
          }),
        ),
        async (c) => {
          const learnerId = asLearnerId(c.get("user").id);
          const subjectId = asSubjectId(c.req.valid("param").subjectId);
          const body = c.req.valid("json");
          const store = createPlacementStore(deps.db);
          const test = (await store.list(learnerId, subjectId)).find(
            (t) => t.completedAt === null,
          );
          if (!test) return fail(c, 409, "placement_not_started");
          const item = (await store.items(test.id)).find(
            (i) => i.id === body.itemId,
          );
          if (!item) return fail(c, 404, "not_found");
          if (item.answeredAt !== null) return fail(c, 409, "already_answered");
          if (busy.has(learnerId)) return fail(c, 429, "slow_down");
          busy.add(learnerId);
          try {
            let correct = false;
            if (body.response !== null) {
              const checked = await deps.math.checkAnswer(
                item.answer,
                body.response,
              );
              if (!checked.ok) return fail(c, 503, "math_unavailable");
              // Réponse illisible : à réécrire, elle ne compte pas.
              if (
                checked.value.reason === "invalid_input" ||
                checked.value.reason === "too_complex"
              )
                return fail(c, 422, "unreadable_answer");
              correct = checked.value.correct;
            }
            const now = deps.now();
            const eventId = asEventId(randomUUID());
            const recorded = await deps.db.transaction(async (tx) => {
              const saved = await createPlacementStore(tx).answer({
                itemId: item.id,
                response: body.response,
                correct,
                eventId,
                at: now,
              });
              if (!saved) return false;
              const appended = await createEventStore(tx).append({
                id: eventId,
                learnerId,
                occurredAt: now,
                source: "web",
                payload: {
                  type: "answer.submitted",
                  notionId: item.notionId,
                  correct,
                  hintsUsed: 0,
                  misconceptionId: null,
                  exerciseRef: `placement:${item.id}`,
                  response: body.response,
                  misconceptionSource: null,
                  misconceptionConfidence: null,
                  scaffolded: false,
                  format: null,
                  placement: true,
                },
              });
              if (!appended.ok)
                throw new Error("identifiant d'événement en conflit");
              return true;
            });
            if (!recorded) return fail(c, 409, "already_answered");
            return c.json({ ok: true }, 200);
          } finally {
            busy.delete(learnerId);
          }
        },
      )
      // Résultat du dernier test terminé : estimation par notion, avec ses preuves.
      .get("/:subjectId/result", subjectParam, async (c) => {
        const learnerId = asLearnerId(c.get("user").id);
        const subjectId = asSubjectId(c.req.valid("param").subjectId);
        const program = await programOf(learnerId, subjectId);
        if (!program) return fail(c, 404, "no_program");
        const store = createPlacementStore(deps.db);
        const tests = await store.list(learnerId, subjectId);
        const test = tests.find((t) => t.completedAt !== null);
        if (!test) return fail(c, 404, "placement_not_done");
        const ctx = await contextOf(learnerId, program);
        const answers = answersOf(await store.items(test.id));
        const { model } = await learnerModel(deps.db, learnerId);
        const notions = placementEstimates(ctx.scope, answers)
          // Hors programme : seulement les prérequis interrogés ou estimés.
          .filter(
            (e) => ctx.inProgram.has(e.notionId) || e.level !== "not_assessed",
          )
          .map((e) => {
            const status: NotionStatus =
              model.notions[e.notionId]?.status ?? "not_seen";
            return {
              notionId: e.notionId,
              name: ctx.names.get(e.notionId) ?? "",
              level: e.level,
              source: e.source,
              evidence: e.evidence.map((id) => ({
                notionId: id,
                name: ctx.names.get(id) ?? "",
              })),
              status,
              inProgram: ctx.inProgram.has(e.notionId),
            };
          });
        return c.json(
          {
            subjectName: program.subjectName,
            subjectIcon: program.subjectIcon,
            completedAt: test.completedAt?.toISOString() ?? null,
            answered: answers.length,
            availableAt:
              placementAvailableAt(
                test.completedAt,
                deps.now(),
              )?.toISOString() ?? null,
            notions,
          },
          200,
        );
      })
  );
}
