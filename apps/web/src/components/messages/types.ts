import type { AppType } from "@wema/api";
import type { hc } from "hono/client";

/** Corps d'une réponse réussie d'une route du client typé. */
type Ok<F> = F extends (...args: never[]) => Promise<infer R>
  ? R extends { ok: true; json(): Promise<infer T> }
    ? T
    : never
  : never;

type Api = ReturnType<typeof hc<AppType>>["api"]["messages"];

/** Ton de l'interface : tutoiement pour l'élève, vouvoiement pour les adultes. */
export type Tone = "learner" | "adult";

export type ThreadList = Ok<Api["threads"]["$get"]>;
export type ThreadItem = ThreadList["threads"][number];
export type ThreadDetail = Ok<Api["threads"][":id"]["$get"]>;
export type ThreadMessage = ThreadDetail["messages"][number];
export type ContactData = Ok<Api["contacts"]["$get"]>;
export type Contact = ContactData["contacts"][number];
export type TeachingClass = ContactData["classes"][number];
