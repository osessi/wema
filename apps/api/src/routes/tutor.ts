import { randomUUID } from "node:crypto";
import { zValidator } from "@hono/zod-validator";
import type { AiError } from "@wema/ai-gateway";
import {
  createAccountStore,
  createEventStore,
  createExerciseStore,
  createTutorStore,
} from "@wema/db";
import {
  asEventId,
  asExerciseVariantId,
  asLearnerId,
  asNotionId,
  asUserId,
  type LearnerId,
  type LearningEventPayload,
  type NotionId,
  type TutorMode,
  type TutorSession,
} from "@wema/domain";
import { createTutor, type TurnMessage } from "@wema/tutor";
import { type Context, Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { accessGuard, subscriptionRequired } from "../billing/access";
import type { Deps, Env } from "../context";
import { fail, requireSession } from "../http";
import { createRateLimiter } from "../rate-limit";
import {
  buildTutorContext,
  notionInfo,
  subjectNamesOf,
} from "../tutor-context";

const uuid = z.uuid();
const modeSchema = z.enum([
  "exercise_help",
  "course_question",
  "teach_back",
  "oral_check",
  "intake",
]);
/** Modes qui portent sur une variante d'exercice de l'élève. */
const EXERCISE_MODES: readonly TutorMode[] = ["exercise_help", "oral_check"];
/** Messages au plus par séance (au-delà, on en ouvre une autre). */
export const MAX_MESSAGES_PER_SESSION = 100;
/**
 * Entretiens initiaux menés au plus par compte. L'entretien est gratuit (sans
 * abonnement) et ses appels sont « essentiels » (jamais bloqués par un plafond
 * de coût) : sans borne, n'importe quel compte gratuit consommerait l'IA sans fin.
 */
export const MAX_INTAKE_SESSIONS = 3;
/** Derniers messages envoyés au modèle : borne le coût d'une longue séance. */
export const HISTORY_WINDOW = 20;
/** Indices au plus par séance. */
export const MAX_HINTS = 3;

/** Un message d'erreur de fournisseur n'est jamais transmis tel quel à l'élève. */
const aiFailure = (c: Context, error: AiError) =>
  fail(
    c,
    error.kind === "rate_limited" ? 429 : 503,
    error.kind === "misconfigured" ? "ai_not_configured" : "ai_unavailable",
  );

const toTurns = (
  messages: readonly { role: "learner" | "tutor"; content: string }[],
): TurnMessage[] =>
  messages
    .slice(-HISTORY_WINDOW)
    .map((m) => ({ role: m.role, content: m.content }));

/** Espace élève : séances avec le prof IA de la matière, et entretien initial. */
export function tutorRoutes(deps: Deps) {
  const sessions = createTutorStore(deps.db);
  const tutor = createTutor(deps.ai, { verifier: deps.math });
  // Garde-fou de coût : 40 échanges avec le prof IA par élève et par quart d'heure.
  const limiter = createRateLimiter({
    max: 40,
    windowMs: 15 * 60 * 1000,
    now: deps.now,
  });

  const ownSession = async (
    c: Context<Env>,
    id: string,
  ): Promise<TutorSession | null> => {
    const session = await sessions.getSession(id);
    return session && session.learnerId === asLearnerId(c.get("user").id)
      ? session
      : null;
  };

  /** Le coût est imputé à l'organisation de l'élève ; le fournisseur ne reçoit que des identifiants techniques. */
  const aiContext = async (session: TutorSession) => {
    const memberships = await createAccountStore(deps.db).listMemberships(
      asUserId(session.learnerId),
    );
    return {
      organizationId: memberships[0]?.organizationId ?? null,
      learnerId: session.learnerId,
    };
  };

  const contextOf = (session: TutorSession) =>
    session.notionId
      ? buildTutorContext(deps.db, {
          healthKey: deps.healthKey,
          learnerId: session.learnerId,
          notionId: session.notionId,
          variantId: session.variantId,
          mode: session.mode,
          hintLevel: session.hintLevel,
        })
      : Promise.resolve(null);

  const canUse = (learnerId: LearnerId, notionId: NotionId) =>
    accessGuard(deps.db, deps.billing.access, learnerId, deps.now()).notion(
      notionId,
    );

  /** Séance qui accepte encore des messages, ou le code d'erreur à renvoyer. */
  const refusalFor = async (session: TutorSession) => {
    if (
      session.notionId &&
      !(await canUse(session.learnerId, session.notionId))
    )
      return "subscription_required" as const;
    if (session.status !== "open" || (await sessions.isFinishing(session.id)))
      return "session_finished" as const;
    if ((await sessions.countMessages(session.id)) >= MAX_MESSAGES_PER_SESSION)
      return "session_too_long" as const;
    if (!limiter.hit(session.learnerId)) return "too_many_messages" as const;
    return null;
  };

  const refuse = (
    c: Context<Env>,
    refusal: NonNullable<Awaited<ReturnType<typeof refusalFor>>>,
  ) =>
    refusal === "subscription_required"
      ? subscriptionRequired(c)
      : fail(c, refusal === "too_many_messages" ? 429 : 409, refusal);

  return new Hono<Env>()
    .use(requireSession(deps))
    .post(
      "/sessions",
      zValidator(
        "json",
        z.object({
          mode: modeSchema,
          notionId: uuid.optional(),
          variantId: uuid.optional(),
        }),
      ),
      async (c) => {
        const learnerId = asLearnerId(c.get("user").id);
        const body = c.req.valid("json");
        if (body.mode === "intake") {
          // Un entretien encore ouvert est repris ; au-delà du plafond, plus d'entretien.
          const { rows } = await deps.db.query<{
            id: string;
            open: boolean;
          }>(
            `SELECT s.id, s.status <> 'finished' AS open FROM tutor_sessions s
             WHERE s.learner_id = $1 AND s.mode = 'intake'
               AND (s.status <> 'finished' OR EXISTS (
                 SELECT 1 FROM tutor_messages m WHERE m.session_id = s.id AND m.role = 'learner'))
             ORDER BY s.created_at DESC`,
            [learnerId],
          );
          const reopen = rows.find((r) => r.open);
          const resumed = reopen ? await sessions.getSession(reopen.id) : null;
          if (resumed) return c.json({ ok: true, session: resumed }, 201);
          if (rows.length >= MAX_INTAKE_SESSIONS)
            return fail(c, 409, "intake_limit_reached");
          const session = await sessions.createSession({
            learnerId,
            notionId: null,
            variantId: null,
            mode: "intake",
          });
          return c.json({ ok: true, session }, 201);
        }
        let notionId = body.notionId ? asNotionId(body.notionId) : null;
        const variantId = body.variantId
          ? asExerciseVariantId(body.variantId)
          : null;
        if (EXERCISE_MODES.includes(body.mode)) {
          const exercises = createExerciseStore(deps.db);
          const variant = variantId
            ? await exercises.getVariant(variantId)
            : null;
          if (!variant || variant.learnerId !== learnerId)
            return fail(c, 404, "not_found");
          // La vérification orale porte sur une réponse déjà donnée par l'élève.
          if (
            body.mode === "oral_check" &&
            (await exercises.countAttempts(variant.id, learnerId)) === 0
          ) {
            return fail(c, 422, "no_answer_yet");
          }
          const intent = await exercises.getIntent(variant.intentId);
          if (!intent) return fail(c, 404, "not_found");
          notionId = intent.notionId;
        }
        if (!notionId) return fail(c, 422, "notion_required");
        const info = await notionInfo(deps.db, notionId);
        if (!info || info.notion.archived) return fail(c, 404, "not_found");
        // Le prof IA d'une matière est ouvert par un abonnement, un essai ou un contrat.
        if (!(await canUse(learnerId, notionId)))
          return subscriptionRequired(c);
        const session = await sessions.createSession({
          learnerId,
          notionId,
          variantId: EXERCISE_MODES.includes(body.mode) ? variantId : null,
          mode: body.mode,
        });
        return c.json({ ok: true, session }, 201);
      },
    )
    .get("/sessions", async (c) => {
      return c.json(
        {
          sessions: await sessions.listSessions(asLearnerId(c.get("user").id)),
        },
        200,
      );
    })
    .get(
      "/sessions/:id",
      zValidator("param", z.object({ id: uuid })),
      async (c) => {
        const session = await ownSession(c, c.req.valid("param").id);
        if (!session) return fail(c, 404, "not_found");
        return c.json(
          { session, messages: await sessions.listMessages(session.id) },
          200,
        );
      },
    )
    .post(
      "/sessions/:id/messages",
      zValidator("param", z.object({ id: uuid })),
      zValidator(
        "json",
        z.object({ content: z.string().trim().min(1).max(2000) }),
      ),
      async (c) => {
        const session = await ownSession(c, c.req.valid("param").id);
        if (!session) return fail(c, 404, "not_found");
        const refusal = await refusalFor(session);
        if (refusal) return refuse(c, refusal);
        const content = c.req.valid("json").content;
        const turns: TurnMessage[] = [
          ...toTurns(await sessions.listMessages(session.id)),
          { role: "learner", content },
        ];
        const context = await aiContext(session);
        const ctx = session.mode === "intake" ? null : await contextOf(session);
        if (session.mode !== "intake" && !ctx) return fail(c, 404, "not_found");
        // Le flux n'est permis que s'il n'y a aucune réponse à protéger.
        const streamable =
          session.mode === "intake" ||
          (ctx !== null && (ctx.protectedAnswers ?? []).length === 0);

        const answer = async (onDelta?: (d: string) => void) => {
          if (session.mode === "intake") {
            return tutor.intakeReply(
              await subjectNamesOf(deps.db, session.learnerId),
              turns,
              context,
              onDelta,
            );
          }
          return ctx ? tutor.reply(ctx, turns, context, onDelta) : null;
        };

        // Les deux messages ne sont enregistrés qu'une fois la réponse obtenue.
        const save = async (text: string, guarded: boolean) => {
          await sessions.addMessage({
            sessionId: session.id,
            role: "learner",
            content,
            guarded: false,
          });
          return sessions.addMessage({
            sessionId: session.id,
            role: "tutor",
            content: text,
            guarded,
          });
        };

        if (c.req.header("accept")?.includes("text/event-stream")) {
          return streamSSE(c, async (stream) => {
            const reply = await answer(
              streamable
                ? (delta) => {
                    void stream.writeSSE({ event: "delta", data: delta });
                  }
                : undefined,
            );
            if (!reply?.ok) {
              await stream.writeSSE({
                event: "error",
                data: !reply
                  ? "not_found"
                  : reply.error.kind === "rate_limited"
                    ? "ai_busy"
                    : reply.error.kind === "misconfigured"
                      ? "ai_not_configured"
                      : "ai_unavailable",
              });
              return;
            }
            if (!streamable)
              await stream.writeSSE({ event: "delta", data: reply.value.text });
            const saved = await save(reply.value.text, reply.value.guarded);
            // Le texte final fait foi : il peut différer du flux (mise en forme, phrase coupée retirée).
            await stream.writeSSE({
              event: "done",
              data: JSON.stringify({
                messageId: saved.id,
                content: saved.content,
                guarded: saved.guarded,
              }),
            });
          });
        }
        const reply = await answer();
        if (!reply) return fail(c, 404, "not_found");
        if (!reply.ok) return aiFailure(c, reply.error);
        const saved = await save(reply.value.text, reply.value.guarded);
        return c.json({
          ok: true,
          message: { id: saved.id, content: saved.content },
        });
      },
    )
    .post(
      "/sessions/:id/hint",
      zValidator("param", z.object({ id: uuid })),
      async (c) => {
        const session = await ownSession(c, c.req.valid("param").id);
        if (!session) return fail(c, 404, "not_found");
        // Les indices portent sur un exercice : pas en question de cours ni en entretien.
        if (session.mode !== "exercise_help")
          return fail(c, 422, "hints_not_available");
        if (session.hintLevel >= MAX_HINTS)
          return fail(c, 409, "hints_exhausted");
        const refusal = await refusalFor(session);
        if (refusal) return refuse(c, refusal);
        const ctx = await contextOf(session);
        if (!ctx) return fail(c, 404, "not_found");
        const hint = await tutor.hint(
          ctx,
          toTurns(await sessions.listMessages(session.id)),
          await aiContext(session),
        );
        if (!hint.ok) return aiFailure(c, hint.error);
        const saved = await sessions.addMessage({
          sessionId: session.id,
          role: "tutor",
          content: hint.value.text,
          guarded: hint.value.guarded,
        });
        await sessions.raiseHintLevel(session.id, hint.value.level);
        if (session.notionId) {
          const payload: LearningEventPayload = {
            type: "hint.requested",
            notionId: session.notionId,
            exerciseRef: session.variantId,
            level: hint.value.level,
          };
          await createEventStore(deps.db).append({
            id: asEventId(randomUUID()),
            learnerId: session.learnerId,
            occurredAt: deps.now(),
            source: "web",
            payload,
          });
        }
        return c.json({
          ok: true,
          level: hint.value.level,
          message: { id: saved.id, content: saved.content },
        });
      },
    )
    .post(
      "/sessions/:id/finish",
      zValidator("param", z.object({ id: uuid })),
      async (c) => {
        const session = await ownSession(c, c.req.valid("param").id);
        if (!session) return fail(c, 404, "not_found");
        // Réservation atomique : une double demande ne produit pas deux évaluations.
        if (!(await sessions.claimFinish(session.id)))
          return fail(c, 409, "session_finished");
        try {
          return await finish(c, session);
        } catch (e) {
          // Panne imprévue : la séance redevient ouverte au lieu de rester bloquée.
          await sessions.releaseFinish(session.id);
          throw e;
        }
      },
    );

  /** Fin de séance réservée : évaluation éventuelle, puis événement et fin enregistrés ensemble. */
  async function finish(c: Context<Env>, session: TutorSession) {
    const turns = toTurns(await sessions.listMessages(session.id));
    const context = await aiContext(session);
    const spoke = turns.some((t) => t.role === "learner");
    let payload: LearningEventPayload | null = null;
    let assessment: { understanding: number; confidence: number } | null = null;

    if (session.mode === "intake" && spoke) {
      const hypotheses = await tutor.extractIntake(turns, context);
      if (!hypotheses.ok) {
        await sessions.releaseFinish(session.id);
        return aiFailure(c, hypotheses.error);
      }
      payload = {
        type: "intake.completed",
        sessionId: session.id,
        hypotheses: hypotheses.value,
      };
    } else if (
      (session.mode === "teach_back" || session.mode === "oral_check") &&
      spoke &&
      session.notionId
    ) {
      const ctx = await contextOf(session);
      const result = ctx ? await tutor.assess(ctx, turns, context) : null;
      if (!result?.ok) {
        await sessions.releaseFinish(session.id);
        return result ? aiFailure(c, result.error) : fail(c, 404, "not_found");
      }
      const value = result.value;
      payload = {
        type:
          session.mode === "teach_back"
            ? "teachback.assessed"
            : "oralcheck.assessed",
        notionId: session.notionId,
        exerciseRef: session.variantId,
        understanding: value.understanding,
        confidence: value.confidence,
        misconceptionIds: value.misconceptionIds,
        sessionId: session.id,
        summary: value.summary,
      };
      assessment = {
        understanding: value.understanding,
        confidence: value.confidence,
      };
    }
    const event = payload;
    await deps.db.transaction(async (tx) => {
      if (event) {
        await createEventStore(tx).append({
          id: asEventId(randomUUID()),
          learnerId: session.learnerId,
          occurredAt: deps.now(),
          source: "web",
          payload: event,
        });
      }
      await createTutorStore(tx).finishSession(session.id);
    });
    return c.json({
      ok: true,
      assessment,
      hypotheses: event?.type === "intake.completed" ? event.hypotheses : null,
    });
  }
}
