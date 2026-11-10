import { z } from "zod";
import { PRESENTATION_FORMATS, type PresentationFormat } from "./exercises";
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
import {
  containsHealthTerm,
  isPreferenceKey,
  type PreferenceKey,
} from "./profile";
import { err, ok, type Result } from "./result";

export type EventSource =
  | "app"
  | "web"
  | "messaging"
  | "paper"
  | "teacher"
  /** Conseiller Wema, après le rendez-vous de diagnostic. */
  | "advisor";

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
  /** Qui a repéré l'idée fausse : l'IA (avec sa confiance) ou une règle certaine. */
  misconceptionSource: "ai" | null;
  misconceptionConfidence: number | null;
  /** Variante présentée en étapes guidées (null : inconnu, avant le lot 6). */
  scaffolded: boolean | null;
  /** Format dans lequel l'énoncé était présenté (absent ou null : inconnu, avant le lot 11). */
  format?: PresentationFormat | null;
  /**
   * Réponse donnée pendant le test de niveau (positionnement), avant le
   * parcours : une réponse comme une autre pour la maîtrise, sans indice ni
   * correction affichée. Absent : faux.
   */
  placement?: boolean | undefined;
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

/** Préférence ou centre d'intérêt déclaré par l'élève, son parent ou un prof. */
export interface PreferenceDeclared {
  type: "preference.declared";
  key: PreferenceKey;
  /** Libellé libre d'un centre d'intérêt (ex. « football »). */
  label: string | null;
  /** Vrai : l'hypothèse est affirmée ; faux : elle est démentie. */
  value: boolean;
  source: "guardian" | "teacher" | "learner";
}

/** Hypothèses tirées de l'entretien initial (jamais de besoin de santé). */
export interface IntakeCompleted {
  type: "intake.completed";
  sessionId: string;
  hypotheses: readonly {
    key: PreferenceKey;
    label: string | null;
    confidence: number;
  }[];
}

/**
 * Copie photographiée relue par le prof IA (source « paper »). C'est une
 * observation du raisonnement, jamais une réponse : elle ne compte pas pour la
 * maîtrise (seule une réponse vérifiée par services/math le fait), mais une
 * idée fausse repérée avec assez de confiance entre dans la couche « erreurs ».
 * La photo elle-même n'est pas conservée.
 */
export interface CopyReviewed {
  type: "copy.reviewed";
  notionId: NotionId;
  exerciseRef: string | null;
  /** Étapes lues sur la copie, et combien semblent justes. */
  stepsRead: number;
  stepsCorrect: number;
  /** Rang (à partir de 0) de la première étape où le raisonnement coince, s'il y en a une. */
  stuckStep: number | null;
  /** Idée fausse probable, rattachée à celles de la notion, avec la confiance de l'IA. */
  misconceptionId: MisconceptionId | null;
  misconceptionConfidence: number | null;
  /** Ce qui coince, en une phrase (preuve pour le profil explicable), sans la réponse. */
  summary: string;
}

/**
 * Compte rendu d'une séance avec un prof (source « teacher ») : ce qui a été
 * travaillé et sur quelles notions. C'est une observation du prof, jamais une
 * réponse : il ne compte pas pour la maîtrise, il sert de preuve au profil.
 */
export interface SessionReported {
  type: "session.reported";
  /** Séance de l'agenda d'où vient le compte rendu. */
  sessionId: string;
  notionIds: readonly NotionId[];
  summary: string;
}

/**
 * Compte rendu du rendez-vous de diagnostic avec un conseiller Wema (source
 * « advisor »). Ce sont des observations et des hypothèses d'un humain, avec
 * leur confiance, jamais un diagnostic médical : aucun texte ne peut évoquer
 * la santé (les besoins de santé passent par le consentement du parent). Il
 * ne compte pas pour la maîtrise.
 */
export interface DiagnosticReported {
  type: "diagnostic.reported";
  /** Rendez-vous d'où vient le compte rendu (preuve). */
  appointmentId: string;
  /** Fiche du conseiller : chaque champ peut rester vide. */
  sheet: DiagnosticSheet;
  hypotheses: readonly {
    key: PreferenceKey;
    label: string | null;
    /** Vrai : le conseiller l'affirme ; faux : il la dément. */
    value: boolean;
    confidence: number;
  }[];
}

/** Rubriques de la fiche de diagnostic. */
export const DIAGNOSTIC_SHEET_FIELDS = [
  "since",
  "where",
  "blockers",
  "motivation",
  "learningStyle",
  "needs",
] as const;
export type DiagnosticSheetField = (typeof DIAGNOSTIC_SHEET_FIELDS)[number];
export type DiagnosticSheet = Readonly<Record<DiagnosticSheetField, string>>;

export type LearningEventPayload =
  | DiagnosticReported
  | AnswerSubmitted
  | HintRequested
  | TutorAssessment
  | PreferenceDeclared
  | IntakeCompleted
  | CopyReviewed
  | SessionReported
  | TeacherNoted;

/**
 * Note libre d'un prof sur un élève (source « teacher », hypothèse
 * `declared_teacher`) : une observation, jamais une consigne pour le prof IA,
 * et jamais une donnée de santé. Elle ne compte pas pour la maîtrise.
 */
export interface TeacherNoted {
  type: "teacher.noted";
  /** Organisation du prof : seuls ses collègues relisent la note. */
  organizationId: string;
  text: string;
}

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
  misconceptionSource: z.enum(["ai"]).nullable().default(null),
  misconceptionConfidence: z.number().min(0).max(1).nullable().default(null),
  // Absent des événements enregistrés avant le lot 6.
  scaffolded: z.boolean().nullable().default(null),
  // Absent des événements enregistrés avant le lot 11.
  format: z.enum(PRESENTATION_FORMATS).nullable().default(null),
  // Absent des événements enregistrés avant le test de niveau (migration 0029).
  placement: z.boolean().optional(),
});

const preferenceKey = z
  .string()
  .refine(isPreferenceKey)
  .transform((k) => (isPreferenceKey(k) ? k : ("interest" as const)));
const preferenceDeclaredSchema = z.object({
  type: z.literal("preference.declared"),
  key: preferenceKey,
  label: z.string().max(80).nullable(),
  value: z.boolean(),
  source: z.enum(["guardian", "teacher", "learner"]),
});
const intakeCompletedSchema = z.object({
  type: z.literal("intake.completed"),
  sessionId: z.string().min(1),
  hypotheses: z.array(
    z.object({
      key: preferenceKey,
      label: z.string().max(80).nullable(),
      confidence: z.number().min(0).max(1),
    }),
  ),
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

const copyReviewedSchema = z.object({
  type: z.literal("copy.reviewed"),
  notionId: z.string().min(1).transform(asNotionId),
  exerciseRef: z.string().nullable(),
  stepsRead: z.number().int().min(0),
  stepsCorrect: z.number().int().min(0),
  stuckStep: z.number().int().min(0).nullable(),
  misconceptionId: z.string().min(1).transform(asMisconceptionId).nullable(),
  misconceptionConfidence: unit.nullable(),
  summary: z.string().max(500),
});

const sessionReportedSchema = z.object({
  type: z.literal("session.reported"),
  sessionId: z.string().min(1),
  notionIds: z.array(z.string().min(1).transform(asNotionId)),
  summary: z.string().min(1).max(1000),
});

const sheetText = z
  .string()
  .max(1000)
  .refine((t) => !containsHealthTerm(t), { message: "santé" });
const diagnosticReportedSchema = z.object({
  type: z.literal("diagnostic.reported"),
  appointmentId: z.string().min(1),
  sheet: z.object({
    since: sheetText,
    where: sheetText,
    blockers: sheetText,
    motivation: sheetText,
    learningStyle: sheetText,
    needs: sheetText,
  }),
  hypotheses: z
    .array(
      z.object({
        key: preferenceKey,
        label: z.string().max(80).nullable(),
        value: z.boolean(),
        confidence: unit,
      }),
    )
    .max(20),
});

const teacherNotedSchema = z.object({
  type: z.literal("teacher.noted"),
  organizationId: z.string().min(1),
  // La santé est refusée à l'écriture (`teacherNoteProblem`) et retirée à la
  // projection : pas ici, où un terme ajouté plus tard rendrait le journal illisible.
  text: z.string().min(1).max(500),
});

const learningEventSchema = z.object({
  id: z.uuid().transform(asEventId),
  learnerId: z.uuid().transform(asLearnerId),
  occurredAt: z.union([
    z.date(),
    z.iso.datetime({ offset: true }).transform((s) => new Date(s)),
  ]),
  source: z.enum(["app", "web", "messaging", "paper", "teacher", "advisor"]),
  payload: z.discriminatedUnion("type", [
    answerSubmittedSchema,
    hintRequestedSchema,
    assessmentSchema("teachback.assessed"),
    assessmentSchema("oralcheck.assessed"),
    preferenceDeclaredSchema,
    intakeCompletedSchema,
    copyReviewedSchema,
    sessionReportedSchema,
    diagnosticReportedSchema,
    teacherNotedSchema,
  ]),
});

export function parseLearningEvent(
  input: unknown,
): Result<LearningEvent, string> {
  const parsed = learningEventSchema.safeParse(input);
  return parsed.success ? ok(parsed.data) : err(parsed.error.message);
}
