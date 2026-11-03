import type { ExerciseVariantId, LearnerId, NotionId } from "./ids";

/**
 * Modes du prof IA :
 * - `exercise_help` : guider sur une variante sans la résoudre ;
 * - `course_question` : expliquer la notion ;
 * - `teach_back` : « explique-moi », le prof IA joue l'élève naïf ;
 * - `oral_check` : l'élève justifie sa démarche ;
 * - `intake` : entretien initial (centres d'intérêt, façons d'apprendre, confiance).
 */
export type TutorMode =
  | "exercise_help"
  | "course_question"
  | "teach_back"
  | "oral_check"
  | "intake";

export const TUTOR_MODES: readonly TutorMode[] = [
  "exercise_help",
  "course_question",
  "teach_back",
  "oral_check",
  "intake",
];

export interface TutorSession {
  id: string;
  learnerId: LearnerId;
  /** Notion travaillée ; aucune pour l'entretien initial. */
  notionId: NotionId | null;
  /** Variante concernée (aide sur un exercice, vérification orale). */
  variantId: ExerciseVariantId | null;
  mode: TutorMode;
  /** Niveau du dernier indice donné (0 : aucun). */
  hintLevel: number;
  status: "open" | "finished";
  createdAt: Date;
}

export interface TutorMessage {
  id: string;
  sessionId: string;
  role: "learner" | "tutor";
  content: string;
  /** Vrai si la première réponse du prof IA révélait la réponse et a été remplacée. */
  guarded: boolean;
  createdAt: Date;
}
