import type { AppType } from "@wema/api";
import type { hc } from "hono/client";

/** Corps d'une réponse réussie d'une route du client typé. */
type Ok<F> = F extends (...args: never[]) => Promise<infer R>
  ? R extends { ok: true; json(): Promise<infer T> }
    ? T
    : never
  : never;

type Api = ReturnType<typeof hc<AppType>>["api"];

/** Premiers pas de la famille (GET /onboarding/family). */
export type FamilySteps = Ok<Api["onboarding"]["family"]["$get"]>;
export type ChildSteps = FamilySteps["children"][number];

/** Rendez-vous de diagnostic, côté famille (GET /diagnostic/family). */
export type FamilyDiagnostic = Ok<Api["diagnostic"]["family"]["$get"]>;
export type ChildDiagnostic = FamilyDiagnostic["children"][number];

/** Espace du conseiller (GET /diagnostic/advisor, /diagnostic/advisor/:id). */
export type AdvisorOverview = Ok<Api["diagnostic"]["advisor"]["$get"]>;
export type AdvisorSheet = Ok<Api["diagnostic"]["advisor"][":id"]["$get"]>;
