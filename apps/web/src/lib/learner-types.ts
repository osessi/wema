import type { AppType } from "@wema/api";
import type { hc } from "hono/client";

/** Corps d'une réponse réussie d'une route du client typé. */
type Ok<F> = F extends (...args: never[]) => Promise<infer R>
  ? R extends { ok: true; json(): Promise<infer T> }
    ? T
    : never
  : never;

// Formes des réponses de l'espace élève, déduites du serveur (dates en chaînes ISO).
type Learner = ReturnType<typeof hc<AppType>>["api"]["learner"];

export type NextAction = Ok<Learner["next"]["$get"]>["actions"][number];
export type Nudge = Ok<Learner["nudges"]["$get"]>["nudges"][number];
export type Assignment = Ok<
  Learner["assignments"]["$get"]
>["assignments"][number];
export type AssignmentStatus = Assignment["status"];
export type Variant = Ok<Learner["variants"]["$get"]>["variants"][number];
export type PathClass = Ok<Learner["path"]["$get"]>["classes"][number];
export type PathNotion = PathClass["notions"][number];
export type NotionStatus = PathNotion["status"];
export type LearnerProfile = Ok<Learner["profile"]["$get"]>;
export type ProfileHypothesis = LearnerProfile["hypotheses"][number];
export type TutorSessionSummary = Ok<
  Learner["tutor"]["sessions"]["$get"]
>["sessions"][number];
export type TutorSessionDetail = Ok<
  Learner["tutor"]["sessions"][":id"]["$get"]
>;
export type TutorMode = TutorSessionSummary["mode"];

/** Modes du prof IA qu'un élève peut ouvrir lui-même (dans l'ordre affiché). */
export const TUTOR_MODES = [
  "course_question",
  "exercise_help",
  "teach_back",
  "oral_check",
  "intake",
] as const satisfies readonly TutorMode[];

/** Modes qui portent sur un exercice (variante) plutôt que sur une notion. */
export const EXERCISE_MODES: readonly TutorMode[] = [
  "exercise_help",
  "oral_check",
];

/** Préférences de format que l'élève peut déclarer (catalogue de l'API). */
export const LEARNER_PREFERENCES = [
  "format.scaffolded",
  "format.examples",
  "format.visual",
  "format.comics",
  "format.audio",
  "pace.short_sessions",
] as const;
