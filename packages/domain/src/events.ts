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
  /** Réponse saisie par l'élève, telle quelle (preuve pour le profil explicable). */
  response: string | null;
}

/** L'élève a demandé un indice au prof IA. */
export interface HintRequested {
  type: "hint.requested";
  notionId: NotionId;
  exerciseRef: string | null;
  /** Niveau de l'indice donné, de 1 (relance) à 3 (étape partielle). */
  level: number;
}

/**
 * Évaluation de fin de séance par le prof IA : « explique-moi » (l'élève a
 * enseigné la notion) ou vérification orale (l'élève a justifié sa démarche).
 * C'est une hypothèse avec sa confiance et ses preuves, jamais un diagnostic.
 */
export interface TutorAssessment {
  type: "teachback.assessed" | "oralcheck.assessed";
  notionId: NotionId;
  exerciseRef: string | null;
  /** Compréhension estimée, de 0 à 1. */
  understanding: number;
  /** Confiance du prof IA dans cette estimation, de 0 à 1. */
  confidence: number;
  misconceptionIds: readonly MisconceptionId[];
  /** Séance d'où vient l'évaluation (les messages en sont la preuve). */
  sessionId: string;
  /** Résumé court de ce qui justifie l'évaluation. */
  summary: string;
}

export type LearningEventPayload =
  | AnswerSubmitted
  | HintRequested
  | TutorAssessment;

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
  // Absent des événements enregistrés avant le lot 3.
  response: z.string().max(500).nullable().default(null),
});

const hintRequestedSchema = z.object({
  type: z.literal("hint.requested"),
  notionId: z.string().min(1).transform(asNotionId),
  exerciseRef: z.string().nullable(),
  level: z.number().int().min(1).max(3),
});

const unit = z.number().min(0).max(1);
const assessmentSchema = <
  T extends "teachback.assessed" | "oralcheck.assessed",
>(
  type: T,
) =>
  z.object({
    type: z.literal(type),
    notionId: z.string().min(1).transform(asNotionId),
    exerciseRef: z.string().nullable(),
    understanding: unit,
    confidence: unit,
    misconceptionIds: z.array(z.string().min(1).transform(asMisconceptionId)),
    sessionId: z.string().min(1),
    summary: z.string().max(1000),
  });

const learningEventSchema = z.object({
  id: z.uuid().transform(asEventId),
  learnerId: z.uuid().transform(asLearnerId),
  occurredAt: z.union([
    z.date(),
    z.iso.datetime({ offset: true }).transform((s) => new Date(s)),
  ]),
  source: z.enum(["app", "web", "messaging", "paper", "teacher"]),
  payload: z.discriminatedUnion("type", [
    answerSubmittedSchema,
    hintRequestedSchema,
    assessmentSchema("teachback.assessed"),
    assessmentSchema("oralcheck.assessed"),
  ]),
});

export function parseLearningEvent(
  input: unknown,
): Result<LearningEvent, string> {
  const parsed = learningEventSchema.safeParse(input);
  return parsed.success ? ok(parsed.data) : err(parsed.error.message);
}
