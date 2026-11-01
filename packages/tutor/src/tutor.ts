import type {
  AiContext,
  AiError,
  AiGateway,
  ChatMessage,
} from "@wema/ai-gateway";
import type { MisconceptionId, Result } from "@wema/domain";
import { ok } from "@wema/domain";
import { z } from "zod";
import { revealsAnswer } from "./guard";
import {
  hintInstruction,
  REINFORCED_RULE,
  SAFE_FALLBACK,
  systemPrompt,
  type TutorContext,
} from "./prompts";

export interface TurnMessage {
  role: "learner" | "tutor";
  content: string;
}

export interface TutorReply {
  text: string;
  /** Vrai si une première réponse révélait la solution et a été remplacée. */
  guarded: boolean;
}

/** Seuil de confiance pour retenir une idée fausse repérée par l'IA. */
export const MISCONCEPTION_CONFIDENCE = 0.7;

const toChat = (history: readonly TurnMessage[]): ChatMessage[] =>
  history.map((m) => ({
    role: m.role === "learner" ? "user" : "assistant",
    content: m.content,
  }));

/** Le contrôle s'applique quand la réponse attendue est connue. */
const guarded = (ctx: TutorContext) => ctx.exercise !== null;

/**
 * Prof IA : consignes de la séance, contrôle « jamais la réponse finale »,
 * indices progressifs, analyse d'une réponse fausse, évaluation de fin de séance.
 */
export function createTutor(ai: AiGateway) {
  /** Génère une réponse contrôlée : régénérée une fois si elle donne la solution, puis remplacée. */
  async function safeReply(
    ctx: TutorContext,
    messages: ChatMessage[],
    context: AiContext,
    task: "tutor.reply" | "tutor.hint",
  ): Promise<Result<TutorReply, AiError>> {
    const first = await ai.generateText({
      task,
      messages,
      context,
      temperature: 0.4,
      maxTokens: 400,
    });
    if (!first.ok) return first;
    if (
      !ctx.exercise ||
      !revealsAnswer(first.value.text, ctx.exercise.answer)
    ) {
      return ok({ text: first.value.text.trim(), guarded: false });
    }
    const second = await ai.generateText({
      task,
      messages: [
        ...messages,
        { role: "assistant", content: first.value.text },
        { role: "system", content: REINFORCED_RULE },
      ],
      context,
      temperature: 0.2,
      maxTokens: 400,
    });
    if (second.ok && !revealsAnswer(second.value.text, ctx.exercise.answer)) {
      return ok({ text: second.value.text.trim(), guarded: true });
    }
    return ok({ text: SAFE_FALLBACK, guarded: true });
  }

  return {
    /**
     * Réponse du prof IA au dernier message de l'élève. Quand la solution est
     * connue, la réponse est contrôlée avant d'être envoyée (pas de flux) ;
     * sinon elle est transmise au fil de l'eau par `onDelta`.
     */
    async reply(
      ctx: TutorContext,
      history: readonly TurnMessage[],
      context: AiContext,
      onDelta?: (delta: string) => void,
    ): Promise<Result<TutorReply, AiError>> {
      const messages: ChatMessage[] = [
        { role: "system", content: systemPrompt(ctx) },
        ...toChat(history),
      ];
      if (guarded(ctx) || !onDelta)
        return safeReply(ctx, messages, context, "tutor.reply");
      const streamed = await ai.streamText(
        {
          task: "tutor.reply",
          messages,
          context,
          temperature: 0.5,
          maxTokens: 500,
        },
        onDelta,
      );
      return streamed.ok
        ? ok({ text: streamed.value.text.trim(), guarded: false })
        : streamed;
    },

    /** Indice du niveau suivant (1 à 3), jamais la réponse. */
    async hint(
      ctx: TutorContext,
      history: readonly TurnMessage[],
      context: AiContext,
    ): Promise<Result<TutorReply & { level: number }, AiError>> {
      const level = Math.min(ctx.hintLevel + 1, 3);
      const messages: ChatMessage[] = [
        { role: "system", content: systemPrompt({ ...ctx, hintLevel: level }) },
        ...toChat(history),
        { role: "system", content: hintInstruction(level) },
      ];
      const reply = await safeReply(ctx, messages, context, "tutor.hint");
      return reply.ok ? ok({ ...reply.value, level }) : reply;
    },

    /**
     * Idée fausse probable derrière une réponse fausse, parmi celles de la
     * notion. Retenue seulement au-dessus du seuil de confiance ; sinon `null`.
     */
    async analyzeWrongAnswer(input: {
      statement: string;
      response: string;
      expected: string;
      misconceptions: readonly { id: MisconceptionId; description: string }[];
      context: AiContext;
    }): Promise<Result<MisconceptionId | null, AiError>> {
      if (input.misconceptions.length === 0) return ok(null);
      const ids = input.misconceptions.map((m) => m.id);
      const schema = z.object({
        misconceptionId: z.string().nullable(),
        confidence: z.number().min(0).max(1),
      });
      const result = await ai.generateObject(
        {
          task: "answer.analyze",
          context: input.context,
          temperature: 0,
          messages: [
            {
              role: "system",
              content:
                "Tu analyses la réponse fausse d'un élève. Choisis, parmi les erreurs de raisonnement listées, celle qui explique le mieux sa réponse, ou null si aucune ne correspond clairement. Donne ta confiance entre 0 et 1.",
            },
            {
              role: "user",
              content: [
                `Énoncé : ${input.statement}`,
                `Réponse attendue : ${input.expected}`,
                `Réponse de l'élève : ${input.response}`,
                "Erreurs possibles :",
                ...input.misconceptions.map(
                  (m) => `- ${m.id} : ${m.description}`,
                ),
              ].join("\n"),
            },
          ],
        },
        schema,
        "analyse_reponse",
      );
      if (!result.ok) return result;
      const { misconceptionId, confidence } = result.value.object;
      const known = ids.find((id) => id === misconceptionId);
      return ok(known && confidence >= MISCONCEPTION_CONFIDENCE ? known : null);
    },

    /** Évaluation de fin de séance « explique-moi » ou de vérification orale. */
    async assess(
      ctx: TutorContext,
      history: readonly TurnMessage[],
      context: AiContext,
    ): Promise<
      Result<
        {
          understanding: number;
          confidence: number;
          misconceptionIds: MisconceptionId[];
          summary: string;
        },
        AiError
      >
    > {
      const schema = z.object({
        understanding: z.number().min(0).max(1),
        confidence: z.number().min(0).max(1),
        misconceptionIds: z.array(z.string()),
        summary: z.string().max(500),
      });
      const transcript = history
        .map(
          (m) => `${m.role === "learner" ? "Élève" : "Prof IA"} : ${m.content}`,
        )
        .join("\n");
      const goal =
        ctx.mode === "teach_back"
          ? "L'élève vient d'expliquer la notion au prof IA qui jouait l'élève naïf."
          : "L'élève vient de justifier sa démarche sur l'exercice.";
      const result = await ai.generateObject(
        {
          task: "session.assess",
          context,
          temperature: 0,
          messages: [
            {
              role: "system",
              content: `${goal} Évalue sa compréhension de la notion « ${ctx.notion.name} » entre 0 et 1, ta confiance entre 0 et 1 (faible si l'échange est court), les erreurs de raisonnement observées parmi celles listées (identifiants seulement), et un résumé factuel de deux phrases au plus, sans jugement sur la personne.`,
            },
            {
              role: "user",
              content: [
                "Erreurs possibles :",
                ...ctx.misconceptions.map(
                  (m) => `- ${m.id} : ${m.description}`,
                ),
                "Échange :",
                transcript,
              ].join("\n"),
            },
          ],
        },
        schema,
        "evaluation_seance",
      );
      if (!result.ok) return result;
      const value = result.value.object;
      // Une évaluation sur un échange trop court ne compte presque pas.
      const turns = history.filter((m) => m.role === "learner").length;
      return ok({
        understanding: value.understanding,
        confidence:
          turns < 2 ? Math.min(value.confidence, 0.3) : value.confidence,
        misconceptionIds: ctx.misconceptions
          .filter((m) => value.misconceptionIds.includes(m.id))
          .map((m) => m.id),
        summary: value.summary,
      });
    },
  };
}

export type Tutor = ReturnType<typeof createTutor>;
