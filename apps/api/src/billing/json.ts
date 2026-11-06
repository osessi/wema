/** Lecture sûre d'un JSON inconnu (réponses et webhooks des fournisseurs), sans `as`. */
export function pick(value: unknown, key: string): unknown {
  if (typeof value !== "object" || value === null) return undefined;
  return Object.entries(value).find(([k]) => k === key)?.[1];
}

export function pickString(value: unknown, key: string): string | undefined {
  const v = pick(value, key);
  return typeof v === "string" ? v : undefined;
}

export function pickNumber(value: unknown, key: string): number | undefined {
  const v = pick(value, key);
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && /^\d+(\.\d+)?$/.test(v)) return Number(v);
  return undefined;
}
