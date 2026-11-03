import type { AppType } from "@wema/api";
import { hc } from "hono/client";
import { apiBaseUrl } from "./config";
import { errorCode } from "./read";
import { isSafeApiUrl } from "./safe-url";

/**
 * Client typé de l'API Wema. Les types des réponses viennent du serveur
 * (`AppType`), comme pour le web. La session est un jeton envoyé en
 * `Authorization: Bearer` ; l'en-tête `x-wema-client: mobile` demande à
 * l'API de renvoyer ce jeton à la connexion plutôt qu'un cookie.
 */
let sessionToken: string | null = null;
let onUnauthenticated: () => void = () => {};

export function setSessionToken(token: string | null) {
  sessionToken = token;
}

export function sessionHeaders(): Record<string, string> {
  return {
    "x-wema-client": "mobile",
    ...(sessionToken ? { authorization: `Bearer ${sessionToken}` } : {}),
  };
}

/** Appelé quand l'API répond « non connecté » (session expirée, code changé). */
export function onSessionLost(handler: () => void) {
  onUnauthenticated = handler;
}

/** Signale une session perdue (réponse 401 lue hors du client typé). */
export function onSessionLostNow() {
  onUnauthenticated();
}

export const api = hc<AppType>(apiBaseUrl(), {
  headers: sessionHeaders,
  // Un identifiant venu d'un lien profond ne doit jamais faire sortir de la route visée.
  fetch: (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (!isSafeApiUrl(url))
      return Promise.reject(new Error("adresse d'API refusée"));
    return fetch(input, init);
  },
}).api;

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; status: number };

interface ApiResponse {
  ok: boolean;
  status: number;
  headers: Headers;
  json(): Promise<unknown>;
}

/** Corps de la réponse réussie parmi les réponses possibles d'une route. */
export type SuccessBody<R> = R extends { json(): Promise<infer T> }
  ? T extends { error: unknown }
    ? never
    : T
  : never;

/** Lit une réponse de l'API : le corps typé, ou un code d'erreur (« network » sans réponse). */
export async function call<R extends ApiResponse>(
  response: Promise<R>,
): Promise<ApiResult<SuccessBody<R>>>;
export async function call(
  response: Promise<ApiResponse>,
): Promise<ApiResult<unknown>> {
  let res: ApiResponse;
  try {
    res = await response;
  } catch {
    return { ok: false, code: "network", status: 0 };
  }
  const json: unknown = res.headers.get("content-type")?.includes("json")
    ? await res.json().catch(() => null)
    : null;
  if (res.ok) return { ok: true, data: json };
  if (res.status === 401) onUnauthenticated();
  return { ok: false, code: errorCode(json), status: res.status };
}
