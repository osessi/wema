// Écritures depuis le navigateur, vers /api (même origine, redirigé vers le
// serveur API par next.config.ts).

export type MutationResult =
  | { ok: true; data: unknown }
  | { ok: false; code: string; details: unknown };

export async function mutate(
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
): Promise<MutationResult> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: "same-origin",
      headers: body === undefined ? {} : { "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    return { ok: false, code: "network", details: null };
  }
  const data: unknown = res.headers.get("content-type")?.includes("json")
    ? await res.json()
    : null;
  if (res.ok) return { ok: true, data };
  const error = read(data, "error");
  const code = read(error, "code");
  return {
    ok: false,
    code: typeof code === "string" ? code : "generic",
    details: read(error, "details"),
  };
}

/** Lit un champ d'un objet JSON inconnu. */
export function read(value: unknown, key: string): unknown {
  if (typeof value !== "object" || value === null) return undefined;
  return Object.entries(value).find(([k]) => k === key)?.[1];
}
