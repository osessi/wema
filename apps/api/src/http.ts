import { can, hashToken, SESSION_TTL_MS } from "@wema/access";
import { createAccountStore } from "@wema/db";
import type { OrganizationId, Permission } from "@wema/domain";
import type { Context } from "hono";
import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { Deps, Env } from "./context";

export const SESSION_COOKIE = "wema_session";

/**
 * Erreur renvoyée au client : un code stable, traduit par l'interface, et des
 * détails facultatifs (champs invalides, contrainte en conflit…).
 */
export function fail(
  c: Context,
  status: ContentfulStatusCode,
  code: string,
  details?: unknown,
) {
  return c.json(
    { error: { code, ...(details === undefined ? {} : { details }) } },
    status,
  );
}

/** Exige une session valide ; pose l'utilisateur et ses appartenances. */
export function requireSession(deps: Deps) {
  return createMiddleware<Env>(async (c, next) => {
    const token = getCookie(c, SESSION_COOKIE);
    if (!token) return fail(c, 401, "unauthenticated");
    const accounts = createAccountStore(deps.db);
    const tokenHash = hashToken(token);
    const user = await accounts.useSession(
      tokenHash,
      deps.now(),
      SESSION_TTL_MS,
    );
    if (!user) return fail(c, 401, "unauthenticated");
    c.set("user", user);
    c.set("memberships", await accounts.listMemberships(user.id));
    c.set("sessionTokenHash", tokenHash);
    await next();
  });
}

/** Vrai si l'utilisateur de la requête a la permission (dans l'organisation donnée). */
export function allowed(
  c: Context<Env>,
  permission: Permission,
  organizationId?: OrganizationId,
): boolean {
  return can(c.get("memberships"), permission, organizationId);
}

/** Exige une permission qui ne dépend pas d'une organisation précise. */
export function requirePermission(permission: Permission) {
  return createMiddleware<Env>(async (c, next) => {
    if (!allowed(c, permission)) return fail(c, 403, "forbidden");
    await next();
  });
}

/**
 * Parade CSRF : une écriture venue du navigateur doit provenir d'une origine
 * autorisée. Le cookie de session est en plus `SameSite=Lax`.
 */
export function checkOrigin(deps: Deps) {
  return createMiddleware(async (c, next) => {
    const origin = c.req.header("origin");
    const safe =
      c.req.method === "GET" ||
      c.req.method === "HEAD" ||
      c.req.method === "OPTIONS";
    if (!safe && origin && !deps.allowedOrigins.includes(origin))
      return fail(c, 403, "bad_origin");
    await next();
  });
}
