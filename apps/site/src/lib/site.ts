/**
 * Réglages du site de présentation. Tout ce qui peut changer sans refaire le
 * site (adresse, prix d'appel, contact) est ici, et seulement ici.
 */

/** Adresse publique du site, utilisée pour le sitemap et les métadonnées. */
export const SITE_URL = (
  process.env.WEMA_SITE_URL ?? "https://wema.winneragency.co"
).replace(/\/$/, "");

/** L'application est servie sous /app, sur le même domaine. */
const APP = "/app";

export const appLinks = {
  login: `${APP}/connexion`,
  signup: `${APP}/inscription`,
  legalNotice: `${APP}/mentions-legales`,
  privacy: `${APP}/confidentialite`,
  terms: `${APP}/conditions`,
  cookies: `${APP}/cookies`,
} as const;

/**
 * Prix d'appel affiché, par matière et par mois. Le modèle économique n'est pas
 * figé : laissez `null` pour n'afficher que « Essai gratuit » et « Abonnement
 * par matière », ou renseignez par exemple « 20 € ». Le prix réel, pays par
 * pays, est toujours celui affiché dans l'application avant tout paiement.
 */
export const PRICE_FROM_PER_SUBJECT_MONTHLY: string | null = null;

export function priceLine(): string {
  return PRICE_FROM_PER_SUBJECT_MONTHLY === null
    ? "Abonnement par matière, après l'essai gratuit."
    : `À partir de ${PRICE_FROM_PER_SUBJECT_MONTHLY} par matière et par mois, après l'essai gratuit.`;
}

/** Les pages du site, dans l'ordre de la navigation. */
export const pages = [
  { href: "/familles", label: "Familles" },
  { href: "/profs-et-ecoles", label: "Profs et écoles" },
  { href: "/questions-frequentes", label: "Questions fréquentes" },
] as const;
