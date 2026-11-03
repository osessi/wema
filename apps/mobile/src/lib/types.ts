import type { api, SuccessBody } from "./api";

// Formes des réponses de l'espace élève, déduites du serveur (dates en chaînes ISO).
type Body<F> = F extends (...args: never[]) => Promise<infer R>
  ? SuccessBody<R>
  : never;
type Learner = typeof api.learner;

export type Me = Body<typeof api.auth.me.$get>;
export type NextAction = Body<Learner["next"]["$get"]>["actions"][number];
export type Nudge = Body<Learner["nudges"]["$get"]>["nudges"][number];
export type Assignment = Body<
  Learner["assignments"]["$get"]
>["assignments"][number];
export const ASSIGNMENT_STATUSES = [
  "late",
  "todo",
  "attempted",
  "done",
  "unavailable",
] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];
/** Statut d'un devoir (l'API l'envoie comme un texte). */
export const assignmentStatus = (value: string): AssignmentStatus =>
  ASSIGNMENT_STATUSES.find((s) => s === value) ?? "unavailable";
export type Variant = Body<Learner["variants"]["$get"]>["variants"][number];
export type PathClass = Body<Learner["path"]["$get"]>["classes"][number];
export type PathNotion = PathClass["notions"][number];
export type NotionStatus = PathNotion["status"];
export type LearnerProfile = Body<Learner["profile"]["$get"]>;
export type TutorSessionSummary = Body<
  Learner["tutor"]["sessions"]["$get"]
>["sessions"][number];
export type TutorSessionDetail = Body<
  Learner["tutor"]["sessions"][":id"]["$get"]
>;
export type TutorMode = TutorSessionSummary["mode"];
export type Thread = Body<typeof api.messages.threads.$get>["threads"][number];
export type ThreadDetail = Body<(typeof api.messages.threads)[":id"]["$get"]>;
export type Contacts = Body<typeof api.messages.contacts.$get>;

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

export const isTutorMode = (value: unknown): value is TutorMode =>
  TUTOR_MODES.some((m) => m === value);

/** Préférences de format que l'élève peut déclarer (catalogue de l'API). */
export const LEARNER_PREFERENCES = [
  "format.scaffolded",
  "format.examples",
  "format.visual",
  "format.comics",
  "format.audio",
  "pace.short_sessions",
] as const;
export type LearnerPreference = (typeof LEARNER_PREFERENCES)[number];
