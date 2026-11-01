// Identifiants marqués : une chaîne de caractères qu'on ne peut pas confondre
// avec un autre type d'identifiant. Les constructeurs ci-dessous sont le seul
// endroit où une conversion `as` est permise.
type Brand<T, B extends string> = T & { readonly __brand: B };

export type CountryId = Brand<string, "CountryId">;
export type CountryCode = Brand<string, "CountryCode">;
export type GradeId = Brand<string, "GradeId">;
export type SubjectId = Brand<string, "SubjectId">;
export type ProgramId = Brand<string, "ProgramId">;
export type UnitId = Brand<string, "UnitId">;
export type NotionId = Brand<string, "NotionId">;
export type MisconceptionId = Brand<string, "MisconceptionId">;
export type LearnerId = Brand<string, "LearnerId">;
export type EventId = Brand<string, "EventId">;
export type UserId = Brand<string, "UserId">;
export type OrganizationId = Brand<string, "OrganizationId">;
export type RoleId = Brand<string, "RoleId">;

// Les identifiants techniques sont des UUID, mis en minuscules comme Postgres
// les renvoie : un même identifiant écrit en majuscules (ex. généré sous iOS)
// reste le même.
const lower = (s: string) => s.toLowerCase();

export const asCountryId = (s: string) => lower(s) as CountryId;
/** Code du pays, en majuscules (ex. FR, BJ). */
export const asCountryCode = (s: string) => s.toUpperCase() as CountryCode;
export const asGradeId = (s: string) => lower(s) as GradeId;
export const asSubjectId = (s: string) => lower(s) as SubjectId;
export const asProgramId = (s: string) => lower(s) as ProgramId;
export const asUnitId = (s: string) => lower(s) as UnitId;
export const asNotionId = (s: string) => lower(s) as NotionId;
export const asMisconceptionId = (s: string) => lower(s) as MisconceptionId;
export const asLearnerId = (s: string) => lower(s) as LearnerId;
export const asEventId = (s: string) => lower(s) as EventId;
export const asUserId = (s: string) => lower(s) as UserId;
export const asOrganizationId = (s: string) => lower(s) as OrganizationId;
export const asRoleId = (s: string) => lower(s) as RoleId;
