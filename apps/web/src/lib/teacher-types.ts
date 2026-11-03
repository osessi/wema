import type { AppType } from "@wema/api";
import type { hc } from "hono/client";

/** Corps d'une réponse réussie d'une route du client typé. */
type Ok<F> = F extends (...args: never[]) => Promise<infer R>
  ? R extends { ok: true; json(): Promise<infer T> }
    ? T
    : never
  : never;

// Formes des réponses de l'API utilisées par l'espace prof (dates en chaînes ISO).
type Api = ReturnType<typeof hc<AppType>>["api"];
type Admin = Api["admin"];
type Org = Admin["organizations"][":id"];

export type ClassDetail = Ok<Admin["classes"][":id"]["$get"]>;
export type ClassMembers = ClassDetail["members"];
export type ClassMap = Ok<Admin["classes"][":id"]["map"]["$get"]>;
export type ClassMapLearner = ClassMap["learners"][number];
export type ClassMapNotion = ClassMap["notions"][number];
export type AssignmentList = Ok<
  Admin["classes"][":id"]["assignments"]["$get"]
>["assignments"];
export type AssignmentItem = AssignmentList[number];
export type ExerciseList = Ok<Org["exercises"]["$get"]>["exercises"];
export type Exercise = ExerciseList[number];
export type BankEntries = Ok<Org["bank"]["$get"]>["entries"];
export type BankEntry = BankEntries[number];
export type LearnerProfile = Ok<Org["learners"][":userId"]["profile"]["$get"]>;
/** Besoin déclaré (donnée de santé), renvoyé seulement avec la permission adaptée. */
export interface DeclaredNeed {
  id: string;
  label: string;
  adaptation: string;
  active: boolean;
  consent: "pending" | "given";
}

const isNeed = (v: unknown): v is DeclaredNeed =>
  typeof v === "object" &&
  v !== null &&
  "id" in v &&
  typeof v.id === "string" &&
  "label" in v &&
  typeof v.label === "string" &&
  "adaptation" in v &&
  typeof v.adaptation === "string" &&
  "active" in v &&
  typeof v.active === "boolean" &&
  "consent" in v &&
  (v.consent === "pending" || v.consent === "given");

/**
 * Besoins déclarés visibles, ou `null` si l'API ne les a pas renvoyés
 * (pas de permission « santé ») : on montre exactement ce qu'elle renvoie.
 */
export function needsOf(profile: object): DeclaredNeed[] | null {
  if (!("needs" in profile) || !Array.isArray(profile.needs)) return null;
  return profile.needs.filter(isNeed);
}
export type ProfileNotion = LearnerProfile["notions"][number];
export type ProfileHypothesis = LearnerProfile["hypotheses"][number];

export type NotionStatus =
  | "not_seen"
  | "needs_work"
  | "in_progress"
  | "mastered";

export const NOTION_STATUSES: readonly NotionStatus[] = [
  "not_seen",
  "needs_work",
  "in_progress",
  "mastered",
];

/** Notion du référentiel, avec son contexte (programme), pour l'affichage. */
export interface NotionInfo {
  id: string;
  name: string;
  countryId: string;
  countryName: string;
  programId: string;
  /** « 4e · Mathématiques ». */
  programLabel: string;
  unitName: string;
  prerequisites: readonly string[];
  misconceptions: readonly { id: string; description: string }[];
}

/** Tâches mathématiques connues (packages/domain/src/exercises.ts). */
export const TASK_KINDS = ["solve", "expand", "factor", "evaluate"] as const;
export type TaskKind = (typeof TASK_KINDS)[number];

/** Préférences reconnues par l'API (catalogue fermé, packages/domain/src/profile.ts). */
export const PREFERENCE_KEYS = [
  "format.scaffolded",
  "format.examples",
  "format.visual",
  "format.comics",
  "format.audio",
  "pace.short_sessions",
  "confidence.low",
  "confidence.high",
  "interest",
] as const;
export type PreferenceKeyUi = (typeof PREFERENCE_KEYS)[number];
