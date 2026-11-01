import { z } from "zod";
import {
  asEventId,
  asLearnerId,
  asMisconceptionId,
  asNotionId,
  type EventId,
  type LearnerId,
  type MisconceptionId,
  type NotionId,
} from "./ids";
import { err, ok, type Result } from "./result";

export type EventSource = "app" | "web" | "messaging" | "paper" | "teacher";

export interface AnswerSubmitted {
  type: "answer.submitted";
  notionId: NotionId;
  correct: boolean;
  /** Nombre d'indices utilisés, entier ≥ 0. */
  hintsUsed: number;
  /** Idée fausse repérée dans la réponse, s'il y en a une. */
  misconceptionId: MisconceptionId | null;
  exerciseRef: string | null;
}

export type LearningEventPayload = AnswerSubmitted;

/** Fait daté du journal d'apprentissage, ajouté sans jamais être modifié. */
export interface LearningEvent {
  id: EventId;
  learnerId: LearnerId;
  occurredAt: Date;
  source: EventSource;
  payload: LearningEventPayload;
}

const answerSubmittedSchema = z.object({
  type: z.literal("answer.submitted"),
  notionId: z.string().min(1).transform(asNotionId),
  correct: z.boolean(),
  hintsUsed: z.number().int().min(0),
  misconceptionId: z.string().min(1).transform(asMisconceptionId).nullable(),
  exerciseRef: z.string().nullable(),
});

const learningEventSchema = z.object({
  id: z.uuid().transform(asEventId),
  learnerId: z.uuid().transform(asLearnerId),
  occurredAt: z.union([
    z.date(),
    z.iso.datetime({ offset: true }).transform((s) => new Date(s)),
  ]),
  source: z.enum(["app", "web", "messaging", "paper", "teacher"]),
  payload: z.discriminatedUnion("type", [answerSubmittedSchema]),
});

export function parseLearningEvent(
  input: unknown,
): Result<LearningEvent, string> {
  const parsed = learningEventSchema.safeParse(input);
  return parsed.success ? ok(parsed.data) : err(parsed.error.message);
}
