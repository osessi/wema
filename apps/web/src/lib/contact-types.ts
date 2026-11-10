import type { AppType } from "@wema/api";
import type { hc } from "hono/client";

type Ok<F> = F extends (...args: never[]) => Promise<infer R>
  ? R extends { ok: true; json(): Promise<infer T> }
    ? T
    : never
  : never;

type Admin = ReturnType<typeof hc<AppType>>["api"]["admin"];

/** Page de demandes de contact (back-office). */
export type ContactRequestsPage = Ok<Admin["contact-requests"]["$get"]>;
export type ContactRequestRow = ContactRequestsPage["requests"][number];
