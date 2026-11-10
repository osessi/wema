import type { AppType } from "@wema/api";
import type { hc } from "hono/client";

/** Corps d'une réponse réussie d'une route du client typé. */
type Ok<F> = F extends (...args: never[]) => Promise<infer R>
  ? R extends { ok: true; json(): Promise<infer T> }
    ? T
    : never
  : never;

type Api = ReturnType<typeof hc<AppType>>["api"];

/** Parcours famille autonome (GET /family). */
export type FamilyOverview = Ok<Api["family"]["$get"]>;
export type FamilyChild = FamilyOverview["children"][number];
export type CatalogProgram = FamilyOverview["catalog"][number];
