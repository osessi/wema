// Identifiants marqués : une chaîne de caractères qu'on ne peut pas confondre
// avec un autre type d'identifiant. Les constructeurs ci-dessous sont le seul
// endroit où une conversion `as` est permise.
type Brand<T, B extends string> = T & { readonly __brand: B };

export type NotionId = Brand<string, "NotionId">;
export type SubjectId = Brand<string, "SubjectId">;
export type CountryCode = Brand<string, "CountryCode">;
export type MisconceptionId = Brand<string, "MisconceptionId">;
export type LearnerId = Brand<string, "LearnerId">;
export type EventId = Brand<string, "EventId">;

export const asNotionId = (s: string) => s as NotionId;
export const asSubjectId = (s: string) => s as SubjectId;
export const asCountryCode = (s: string) => s as CountryCode;
export const asMisconceptionId = (s: string) => s as MisconceptionId;
export const asLearnerId = (s: string) => s as LearnerId;
export const asEventId = (s: string) => s as EventId;
