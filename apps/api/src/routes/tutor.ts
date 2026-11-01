import { randomUUID } from "node:crypto";
import { zValidator } from "@hono/zod-validator";
import type { AiError } from "@wema/ai-gateway";
import {
  createEventStore,
  createExerciseStore,
  createTutorStore,
} from "@wema/db";
import {
  asEventId,
  asExerciseVariantId,
  asLearnerId,
  asNotionId,
  type LearningEventPayload,
  TUTOR_MODES,
  type TutorMode,
  type TutorSession,
} from "@wema/domain";
import { createTutor, type TurnMessage } from "@wema/tutor";
import { type Context, Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import type { Deps, Env } from "../context";
import { fail, requireSession } from "../http";
import { createRateLimiter } from "../rate-limit";
import { buildTutorContext, notionInfo } from "../tutor-context";

const uuid = z.uuid();
const modeSchema = z
  .enum(["exercise_help", "course_question", "teach_back", "oral_check"])
  .refine((m) => TUTOR_MODES.includes(m));
/** Modes qui portent sur une variante d'exercice de l'élève. */
const EXERCISE_MODES: readonly TutorMode[] = ["exercise_help", "oral_check"];

/** Un message d'erreur de fournisseur n'est jamais transmis tel quel à l'élève. */
const aiFailure = (c: Context, error: AiError) =>
  fail(
    c,
    error.kind === "rate_limited" ? 429 : 503,
    error.kind === "misconfigured" ? "ai_not_configured" : "ai_unavailable",
  );

const history = (
  messages: { role: "learner" | "tutor"; content: string }[],
): TurnMessage[] => messages.map((m) => ({ role: m.role, content: m.content }));

/** Espace élève : séances avec le prof IA de la matière. */
export function tutorRoutes(deps: Deps) {
  const sessions = createTutorStore(deps.db);
  const tutor = createTutor(deps.ai);
  // Garde-fou de coût : 40 échanges avec le prof IA par élève et par quart d'heure.
  const limiter = createRateLimiter({
    max: 40,
    windowMs: 15 * 60 * 1000,
    now: deps.now,
  });

  /** Séance ouverte de l'élève connecté, ou une réponse d'erreur. */
  const ownSession = async (
    c: Context<Env>,
    id: string,
  ): Promise<TutorSession | null> => {
    const session = await sessions.getSession(id);
    return session && session.learnerId === asLearnerId(c.get("user").id)
      ? session
      : null;
  };

  const contextOf = (session: TutorSession) =>
    buildTutorContext(deps.db, {
      learnerId: session.learnerId,
      notionId: session.notionId,
      variantId: session.variantId,
      mode: session.mode,
      hintLevel: session.hintLevel,
    });

  // Le fournisseur ne reçoit que des identifiants techniques, jamais de nom.
  const aiContext = (session: TutorSession) => ({
    organizationId: null,
    learnerId: session.learnerId,
  });

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
        let notionId = body.notionId ? asNotionId(body.notionId) : null;
        const variantId = body.variantId
          ? asExerciseVariantId(body.variantId)
          : null;
        if (EXERCISE_MODES.includes(body.mode)) {
          // Aide et vérification portent sur une variante de l'élève : la notion en découle.
          const variant = variantId
            ? await createExerciseStore(deps.db).getVariant(variantId)
            : null;
          if (!variant || variant.learnerId !== learnerId)
            return fail(c, 404, "not_found");
          const intent = await createExerciseStore(deps.db).getIntent(
            variant.intentId,
          );
          if (!intent) return fail(c, 404, "not_found");
          notionId = intent.notionId;
        }
        if (!notionId) return fail(c, 422, "notion_required");
        const info = await notionInfo(deps.db, notionId);
        if (!info || info.notion.archived) return fail(c, 404, "not_found");
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
        if (session.status !== "open") return fail(c, 409, "session_finished");
        if (!limiter.hit(session.learnerId))
          return fail(c, 429, "too_many_messages");
        const ctx = await contextOf(session);
        if (!ctx) return fail(c, 404, "not_found");
        await sessions.addMessage({
          sessionId: session.id,
          role: "learner",
          content: c.req.valid("json").content,
          guarded: false,
        });
        const turns = history(await sessions.listMessages(session.id));

        // Réponse au fil de l'eau si le client la demande (SSE) ; elle n'arrive
        // d'un seul bloc que lorsque la solution doit d'abord être contrôlée.
        if (c.req.header("accept")?.includes("text/event-stream")) {
          return streamSSE(c, async (stream) => {
            const reply = await tutor.reply(
              ctx,
              turns,
              aiContext(session),
              (delta) => {
                void stream.writeSSE({ event: "delta", data: delta });
              },
            );
            if (!reply.ok) {
              await stream.writeSSE({
                event: "error",
                data:
                  reply.error.kind === "rate_limited"
                    ? "ai_busy"
                    : "ai_unavailable",
              });
              return;
            }
            if (ctx.exercise)
              await stream.writeSSE({ event: "delta", data: reply.value.text });
            const saved = await sessions.addMessage({
              sessionId: session.id,
              role: "tutor",
              content: reply.value.text,
              guarded: reply.value.guarded,
            });
            await stream.writeSSE({
              event: "done",
              data: JSON.stringify({ messageId: saved.id }),
            });
          });
        }
        const reply = await tutor.reply(ctx, turns, aiContext(session));
        if (!reply.ok) return aiFailure(c, reply.error);
        const saved = await sessions.addMessage({
          sessionId: session.id,
          role: "tutor",
          content: reply.value.text,
          guarded: reply.value.guarded,
        });
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
        if (session.status !== "open") return fail(c, 409, "session_finished");
        if (!limiter.hit(session.learnerId))
          return fail(c, 429, "too_many_messages");
        const ctx = await contextOf(session);
        if (!ctx) return fail(c, 404, "not_found");
        const turns = history(await sessions.listMessages(session.id));
        const hint = await tutor.hint(ctx, turns, aiContext(session));
        if (!hint.ok) return aiFailure(c, hint.error);
        const saved = await sessions.addMessage({
          sessionId: session.id,
          role: "tutor",
          content: hint.value.text,
          guarded: hint.value.guarded,
        });
        await sessions.raiseHintLevel(session.id, hint.value.level);
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
        if (session.status !== "open") return fail(c, 409, "session_finished");
        const turns = history(await sessions.listMessages(session.id));
        let assessment: { understanding: number; confidence: number } | null =
          null;
        // « Explique-moi » et vérification orale se concluent par une évaluation, ajoutée au journal.
        if (
          (session.mode === "teach_back" || session.mode === "oral_check") &&
          turns.some((t) => t.role === "learner")
        ) {
          const ctx = await contextOf(session);
          if (!ctx) return fail(c, 404, "not_found");
          const result = await tutor.assess(ctx, turns, aiContext(session));
          if (!result.ok) return aiFailure(c, result.error);
          const value = result.value;
          await createEventStore(deps.db).append({
            id: asEventId(randomUUID()),
            learnerId: session.learnerId,
            occurredAt: deps.now(),
            source: "web",
            payload: {
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
            },
          });
          assessment = {
            understanding: value.understanding,
            confidence: value.confidence,
          };
        }
        if (!(await sessions.finishSession(session.id)))
          return fail(c, 409, "session_finished");
        return c.json({ ok: true, assessment });
      },
    );
}
