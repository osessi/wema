import { PGlite } from "@electric-sql/pglite";
import { createMemoryCodeSender, hashPassword } from "@wema/access";
import { bootstrapPlatform, fromPglite, migrate } from "@wema/db";
import { createApp } from "./app";
import type { OAuthProviders } from "./oauth";

export const ADMIN = {
  email: "admin@example.test",
  password: "mot-de-passe-de-test",
};
export const WEB = "http://localhost:3000";

/** Serveur complet sur une base PGlite neuve, avec un super admin. */
export async function testServer(oauth: OAuthProviders = {}) {
  const db = fromPglite(new PGlite());
  await migrate(db);
  const boot = await bootstrapPlatform(db, {
    superAdmin: {
      displayName: "Admin Test",
      email: ADMIN.email,
      passwordHash: await hashPassword(ADMIN.password),
    },
  });
  const codeSender = createMemoryCodeSender();
  const app = createApp({
    db,
    codeSender,
    oauth,
    codeSecret: "secret-de-test",
    secureCookies: false,
    allowedOrigins: [WEB],
    publicUrl: WEB,
    now: () => new Date(),
  });
  return {
    app,
    db,
    codeSender,
    platformId: boot.platform.id,
    superAdminRoleId: boot.superAdminRoleId,
  };
}

type App = Awaited<ReturnType<typeof testServer>>["app"];

/** Navigateur minimal : garde le cookie de session entre les requêtes. */
export function browser(app: App) {
  let cookie = "";
  const call = async (method: string, path: string, body?: unknown) => {
    const headers: Record<string, string> = { origin: WEB };
    if (cookie) headers.cookie = cookie;
    if (body !== undefined) headers["content-type"] = "application/json";
    const res = await app.request(`/api${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const set = res.headers.get("set-cookie");
    const session = set?.match(/wema_session=([^;]*)/);
    if (session) cookie = session[1] ? `wema_session=${session[1]}` : "";
    const text = await res.text();
    const json: unknown =
      text && res.headers.get("content-type")?.includes("json")
        ? JSON.parse(text)
        : null;
    return { status: res.status, json, headers: res.headers };
  };
  return {
    get: (path: string) => call("GET", path),
    post: (path: string, body?: unknown) => call("POST", path, body ?? {}),
    patch: (path: string, body: unknown) => call("PATCH", path, body),
    put: (path: string, body: unknown) => call("PUT", path, body),
    delete: (path: string) => call("DELETE", path),
  };
}

/** Lit un champ d'une réponse JSON sans `as`. */
export function field(json: unknown, ...path: string[]): unknown {
  let value: unknown = json;
  for (const key of path) {
    if (typeof value !== "object" || value === null || !(key in value))
      return undefined;
    value = Object.entries(value).find(([k]) => k === key)?.[1];
  }
  return value;
}

export function text(json: unknown, ...path: string[]): string {
  const value = field(json, ...path);
  if (typeof value !== "string")
    throw new Error(`champ ${path.join(".")} absent : ${JSON.stringify(json)}`);
  return value;
}
