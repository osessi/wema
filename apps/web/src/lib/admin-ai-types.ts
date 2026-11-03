import type { AppType } from "@wema/api";
import type { hc } from "hono/client";

type Ok<F> = F extends (...args: never[]) => Promise<infer R>
  ? R extends { ok: true; json(): Promise<infer T> }
    ? T
    : never
  : never;

type Ai = ReturnType<typeof hc<AppType>>["api"]["admin"]["ai"];

/** Routage de la passerelle IA tel que renvoyé par l'API. */
export type AiRoutingData = Ok<Ai["routing"]["$get"]>;
/** Consommation par tâche sur une période. */
export type AiUsageData = Ok<Ai["usage"]["$get"]>;
