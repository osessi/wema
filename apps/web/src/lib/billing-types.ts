import type { AppType } from "@wema/api";
import type { hc } from "hono/client";

/** Corps d'une réponse réussie d'une route du client typé. */
type Ok<F> = F extends (...args: never[]) => Promise<infer R>
  ? R extends { ok: true; json(): Promise<infer T> }
    ? T
    : never
  : never;

type Api = ReturnType<typeof hc<AppType>>["api"];

/** Abonnements des enfants, vus par leur parent (GET /parent/billing). */
export type ParentBilling = Ok<Api["parent"]["billing"]["$get"]>;
export type BillingChild = ParentBilling["children"][number];
export type BillingOffer = ParentBilling["offers"][number];
export type ChildSubscription = BillingChild["subscriptions"][number];

/** Back-office (GET /admin/billing/…). */
export type AdminOffers = Ok<Api["admin"]["billing"]["offers"]["$get"]>;
export type AdminOffer = AdminOffers["offers"][number];
export type AdminSubscriptions = Ok<
  Api["admin"]["billing"]["subscriptions"]["$get"]
>;
export type ContractOrganizations = Ok<
  Api["admin"]["billing"]["contracts"]["$get"]
>["organizations"];
