import type { AppType } from "@wema/api";
import type { hc } from "hono/client";

/** Corps d'une réponse réussie d'une route du client typé. */
type Ok<F> = F extends (...args: never[]) => Promise<infer R>
  ? R extends { ok: true; json(): Promise<infer T> }
    ? T
    : never
  : never;

// Formes des réponses des formats adaptés, déduites du serveur.
type Learner = ReturnType<typeof hc<AppType>>["api"]["learner"];

export type Presentation = Ok<
  Learner["variants"][":id"]["presentation"]["$get"]
>;
export type PresentationFormat = Presentation["format"];
export type FormatReason = Presentation["reason"];
export type FigureSpec = NonNullable<Presentation["figure"]>;
export type ManipulableKind = NonNullable<Presentation["manipulable"]>;
export type ComicsContent = NonNullable<Presentation["comics"]>;
export type ComicsCharacter = ComicsContent["characters"][number];
export type ComicsPanel = ComicsContent["panels"][number];
export type EasyReadingContent = Presentation["easyReading"];
export type RenderResult = Ok<Learner["variants"][":id"]["render"]["$post"]>;
