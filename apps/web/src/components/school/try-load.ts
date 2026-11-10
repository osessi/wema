import "server-only";
import { redirect } from "next/navigation";
import { load } from "../../lib/api-server";

interface ApiResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

/**
 * Comme `load`, mais une réponse refusée ou introuvable (403, 404…) donne
 * null au lieu d'une erreur : la page affiche alors ce qui est permis.
 */
export async function tryLoad<R extends ApiResponse>(response: Promise<R>) {
  const res = await response;
  if (res.status === 401) redirect("/connexion");
  if (!res.ok) return null;
  return load(Promise.resolve(res));
}
