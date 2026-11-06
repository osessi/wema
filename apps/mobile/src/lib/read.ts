/** Lit un champ d'un objet JSON inconnu, sans `as`. */
export function read(value: unknown, key: string): unknown {
  if (typeof value !== "object" || value === null) return undefined;
  return Object.entries(value).find(([k]) => k === key)?.[1];
}

/** Code d'erreur d'une réponse de l'API (`{ error: { code } }`). */
export function errorCode(body: unknown): string {
  const code = read(read(body, "error"), "code");
  return typeof code === "string" ? code : "generic";
}
