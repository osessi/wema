import type { AppType } from "@wema/api";
import type { hc } from "hono/client";

/** Corps d'une réponse réussie d'une route du client typé. */
type Ok<F> = F extends (...args: never[]) => Promise<infer R>
  ? R extends { ok: true; json(): Promise<infer T> }
    ? T
    : never
  : never;

// Test de niveau : formes déduites du serveur (dates en chaînes ISO).
type Placement = ReturnType<typeof hc<AppType>>["api"]["learner"]["placement"];

export type PlacementSubject = Ok<Placement["$get"]>["subjects"][number];
export type PlacementQuestion = Ok<Placement[":subjectId"]["question"]["$get"]>;
export type PlacementResult = Ok<Placement[":subjectId"]["result"]["$get"]>;
export type PlacementNotionResult = PlacementResult["notions"][number];
export type PlacementLevel = PlacementNotionResult["level"];
