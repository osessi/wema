/**
 * Vrai si l'adresse ne contient aucun segment « . » ou « .. » dans son chemin.
 * Le client Hono insère les paramètres tels quels, et expo-router décode ceux
 * d'un lien profond : un identifiant « ../../autre/route? » enverrait sinon le
 * jeton de session vers une autre route de l'API (audit de sécurité 2026-11).
 */
export function isSafeApiUrl(url: string): boolean {
  const path = url.replace(/^[a-z]+:\/\/[^/]*/i, "").split(/[?#]/)[0] ?? "";
  return !path.split("/").some((segment) => /^(\.|%2e){1,2}$/i.test(segment));
}
