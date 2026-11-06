import type { AppType } from "@wema/api";
import type { hc } from "hono/client";

type Ok<F> = F extends (...args: never[]) => Promise<infer R>
  ? R extends { ok: true; json(): Promise<infer T> }
    ? T
    : never
  : never;

type Api = ReturnType<typeof hc<AppType>>["api"];

/** Réponse de GET /api/notifications (préférences, canaux possibles, journal). */
export type NotificationSettings = Ok<Api["notifications"]["$get"]>;
export type NotificationPreferences = NotificationSettings["preferences"];
export type ChannelChoice = NotificationPreferences["nudgeChannel"];
export type NotificationDelivery = NotificationSettings["deliveries"][number];
