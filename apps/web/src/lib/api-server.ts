import "server-only";
import type { AppType } from "@wema/api";
import { hc } from "hono/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const API_URL = process.env.WEMA_API_URL ?? "http://localhost:4000";

/** Client typé du serveur API, qui transmet le cookie de session du visiteur. */
export async function serverApi() {
  const cookie = (await cookies()).toString();
  return hc<AppType>(API_URL, { headers: { cookie } }).api;
}

interface ApiResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

/** Corps de la réponse réussie parmi les réponses possibles d'une route. */
type SuccessBody<R> = R extends { ok: true; json(): Promise<infer T> }
  ? T
  : never;

/**
 * Lit une réponse de l'API côté serveur : sans session, on renvoie vers la
 * connexion ; une autre erreur est un bug ou une panne, affichée par Next.
 */
export async function load<R extends ApiResponse>(
  response: Promise<R>,
): Promise<SuccessBody<R>>;
export async function load(response: Promise<ApiResponse>): Promise<unknown> {
  const res = await response;
  if (res.status === 401) redirect("/connexion");
  if (!res.ok) throw new Error(`API : réponse ${res.status}`);
  return res.json();
}
