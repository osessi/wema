import type { AppType } from "@wema/api";
import type { hc } from "hono/client";

/** Corps d'une réponse réussie d'une route du client typé. */
type Ok<F> = F extends (...args: never[]) => Promise<infer R>
  ? R extends { ok: true; json(): Promise<infer T> }
    ? T
    : never
  : never;

type Api = ReturnType<typeof hc<AppType>>["api"];
type Learner = Api["admin"]["organizations"][":id"]["learners"][":userId"];

/** Résumé de chaque enfant suivi (GET /parent/children). */
export type ChildSummary = Ok<
  Api["parent"]["children"]["$get"]
>["children"][number];
export type NextActionKind = ChildSummary["nextActions"][number]["kind"];

/** Profil explicable d'un enfant, vu par son parent. */
export type ChildProfile = Ok<Learner["profile"]["$get"]>;
export type ProfileNotion = ChildProfile["notions"][number];
export type ProfileHypothesis = ChildProfile["hypotheses"][number];
/**
 * Besoin déclaré, tel que l'API le décrit. Le type de la route ne le porte
 * pas (deux réponses 200 de formes différentes) : il est relu à l'exécution.
 */
export interface DeclaredNeed {
  id: string;
  need: string;
  label: string;
  adaptation: string;
  active: boolean;
  declaredRole: "guardian" | "teacher";
  consent: "pending" | "given";
}

const field = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null
    ? Object.entries(value).find(([k]) => k === key)?.[1]
    : undefined;

function toNeed(value: unknown): DeclaredNeed | null {
  const id = field(value, "id");
  const need = field(value, "need");
  const label = field(value, "label");
  const adaptation = field(value, "adaptation");
  const active = field(value, "active");
  const declaredRole = field(value, "declaredRole");
  const consent = field(value, "consent");
  if (
    typeof id !== "string" ||
    typeof need !== "string" ||
    typeof label !== "string" ||
    typeof adaptation !== "string" ||
    typeof active !== "boolean" ||
    (declaredRole !== "guardian" && declaredRole !== "teacher") ||
    (consent !== "pending" && consent !== "given")
  )
    return null;
  return { id, need, label, adaptation, active, declaredRole, consent };
}

/** Besoins de la fiche, ou null si le lecteur n'a pas le droit « santé ». */
export function readNeeds(profile: unknown): DeclaredNeed[] | null {
  const needs = field(profile, "needs");
  if (!Array.isArray(needs)) return null;
  return needs.map(toNeed).filter((n) => n !== null);
}

/** Autres organisations de l'enfant, et partage des besoins avec chacune. */
export type HealthShares = Ok<
  Learner["health-shares"]["$get"]
>["organizations"];

export type FamilyMembers = Ok<
  Api["admin"]["organizations"][":id"]["members"]["$get"]
>["members"];
export type FamilyRoles = Ok<
  Api["admin"]["organizations"][":id"]["roles"]["$get"]
>["roles"];

/** Préférences de format que le parent peut déclarer (catalogue fermé de l'API). */
export const FORMAT_PREFERENCES = [
  "format.scaffolded",
  "format.examples",
  "format.visual",
  "format.comics",
  "format.audio",
  "pace.short_sessions",
  "confidence.low",
  "confidence.high",
] as const;
export type FormatPreference = (typeof FORMAT_PREFERENCES)[number];

/** Besoins particuliers qu'un parent peut déclarer (jamais diagnostiqués par Wema). */
export const NEED_KEYS = [
  "need.dyslexia",
  "need.dyscalculia",
  "need.dyspraxia",
  "need.adhd",
  "need.other",
] as const;
export type NeedKey = (typeof NEED_KEYS)[number];
