import type { AppType } from "@wema/api";
import type { hc } from "hono/client";

/** Corps d'une réponse réussie d'une route du client typé. */
type Ok<F> = F extends (...args: never[]) => Promise<infer R>
  ? R extends { ok: true; json(): Promise<infer T> }
    ? T
    : never
  : never;

type Api = ReturnType<typeof hc<AppType>>["api"];
type Org = Api["admin"]["organizations"][":id"];
type Klass = Api["admin"]["classes"][":id"];

export type Overview = Ok<Org["overview"]["$get"]>["classes"];
export type ClassList = Ok<Org["classes"]["$get"]>["classes"];
export type ClassDetail = Ok<Klass["$get"]>;
export type ClassMembers = ClassDetail["members"];
export type ClassMap = Ok<Klass["map"]["$get"]>;
export type SchoolMembers = Ok<Org["members"]["$get"]>["members"];
export type SchoolMember = SchoolMembers[number];
export type SchoolRoles = Ok<Org["roles"]["$get"]>["roles"];
export type AuditList = Ok<Api["admin"]["audit"]["$get"]>["entries"];

/** Programme du référentiel proposé à la création d'une classe. */
export interface ProgramOption {
  id: string;
  label: string;
}

/** Permissions qu'une école peut donner à un rôle (portée « organisation »). */
export const ORGANIZATION_PERMISSIONS = [
  "curriculum.read",
  "roles.manage",
  "members.manage",
  "audit.read",
  "exercises.read",
  "exercises.write",
  "learners.read",
  "learners.write",
  "learners.health.read",
  "learners.health.write",
  "classes.manage",
] as const;
export type OrganizationPermission = (typeof ORGANIZATION_PERMISSIONS)[number];

export const NOTION_STATUSES = [
  "not_seen",
  "needs_work",
  "in_progress",
  "mastered",
] as const;
export type NotionStatusKey = (typeof NOTION_STATUSES)[number];
