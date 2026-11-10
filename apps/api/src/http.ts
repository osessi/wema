import {
  can,
  hashToken,
  SESSION_MAX_AGE_MS,
  SESSION_TTL_MS,
} from "@wema/access";
import { createAccountStore } from "@wema/db";
import type { OrganizationId, Permission } from "@wema/domain";
import type { Context } from "hono";
import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { Deps, Env } from "./context";

export const SESSION_COOKIE = "wema_session";

/**
 * En-tête posé par l'appli mobile : à la connexion, le jeton de session est
 * renvoyé dans la réponse (au lieu d'un cookie) ; l'appli le garde dans le
 * coffre du téléphone et l'envoie ensuite en `Authorization: Bearer`.
 */
export const CLIENT_HEADER = "x-wema-client";
export const MOBILE_CLIENT = "mobile";

/** Jeton porté par `Authorization: Bearer …`, s'il y en a un. */
function bearerToken(c: Context): string | null {
  const auth = c.req.header("authorization");
  const match = auth?.match(/^Bearer\s+(\S+)$/i);
  return match?.[1] ?? null;
}

/** Vrai si la requête vient d'un client à jeton (appli mobile). */
export function isTokenClient(c: Context): boolean {
  return (
    bearerToken(c) !== null || c.req.header(CLIENT_HEADER) === MOBILE_CLIENT
  );
}

/**
 * Jeton de session de la requête. Un client à jeton (en-tête `Authorization`
 * ou `x-wema-client`) n'est jamais authentifié par le cookie du navigateur :
 * c'est ce qui rend sûre son exemption du contrôle d'origine.
 */
export function sessionTokenOf(c: Context): string | undefined {
  if (
    c.req.header("authorization") !== undefined ||
    c.req.header(CLIENT_HEADER) !== undefined
  )
    return bearerToken(c) ?? undefined;
  return getCookie(c, SESSION_COOKIE);
}

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
    // Plusieurs groupes de routes montés au même chemin (« / », « /learner »,
    // « /admin ») ont chacun ce garde : la session déjà vérifiée pour cette
    // requête n'est ni relue ni prolongée une deuxième fois.
    if (c.get("sessionTokenHash")) return next();
    const token = sessionTokenOf(c);
    if (!token) return fail(c, 401, "unauthenticated");
    const accounts = createAccountStore(deps.db);
    const tokenHash = hashToken(token);
    const user = await accounts.useSession(
      tokenHash,
      deps.now(),
      SESSION_TTL_MS,
      SESSION_MAX_AGE_MS,
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
 *
 * L'appli mobile n'envoie en général pas d'en-tête Origin ; quand elle en
 * envoie un (version web de l'appli), ses requêtes portent `Authorization` ou
 * `x-wema-client` : deux en-têtes qu'une page d'un autre site ne peut pas
 * poser sans requête préalable CORS, que l'API n'autorise pas. Et une requête
 * à jeton ignore le cookie : il n'y a rien à détourner.
 */
export function checkOrigin(deps: Deps) {
  return createMiddleware(async (c, next) => {
    const origin = c.req.header("origin");
    const safe =
      c.req.method === "GET" ||
      c.req.method === "HEAD" ||
      c.req.method === "OPTIONS";
    if (
      !safe &&
      origin &&
      !deps.allowedOrigins.includes(origin) &&
      !isTokenClient(c)
    )
      return fail(c, 403, "bad_origin");
    await next();
  });
}

/** Codes d'une base injoignable : réseau, et arrêt ou démarrage de Postgres. */
const DATABASE_DOWN_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "EPIPE",
  "57P01", // admin_shutdown
  "57P02", // crash_shutdown
  "57P03", // cannot_connect_now (démarrage)
  "08000",
  "08001",
  "08003",
  "08006",
]);

/**
 * Vrai si l'erreur dit que Postgres est momentanément injoignable (redémarrage,
 * coupure) : la requête peut être réessayée, ce n'est pas un bug.
 */
export function isDatabaseUnavailable(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  const code = "code" in e && typeof e.code === "string" ? e.code : null;
  return (
    (code !== null && DATABASE_DOWN_CODES.has(code)) ||
    /^Connection terminated|timeout exceeded when trying to connect/.test(
      e.message,
    )
  );
}
