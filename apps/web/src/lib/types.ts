import type { AppType } from "@wema/api";
import type { hc } from "hono/client";

/** Corps d'une réponse réussie d'une route du client typé. */
type Ok<F> = F extends (...args: never[]) => Promise<infer R>
  ? R extends { ok: true; json(): Promise<infer T> }
    ? T
    : never
  : never;

// Formes des réponses de l'API, déduites du serveur (dates en chaînes ISO).
type Api = ReturnType<typeof hc<AppType>>["api"];
type Curriculum = Api["admin"]["curriculum"];

export type CountryCurriculum = Ok<
  Curriculum["countries"][":id"]["curriculum"]["$get"]
>;
export type CountryList = Ok<Curriculum["countries"]["$get"]>["countries"];
export type NotionData = CountryCurriculum["notions"][number];
export type UnitData = CountryCurriculum["units"][number];
export type SubjectList = Ok<Curriculum["subjects"]["$get"]>["subjects"];
export type RoleList = Ok<
  Api["admin"]["organizations"][":id"]["roles"]["$get"]
>["roles"];
export type MemberList = Ok<
  Api["admin"]["organizations"][":id"]["members"]["$get"]
>["members"];
export type PedagogySettings = Ok<
  Api["admin"]["settings"]["pedagogy"]["$get"]
>["settings"];
export type AuditEntries = Ok<Api["admin"]["audit"]["$get"]>["entries"];
