/**
 * Réglages du site Wema repris par les composants du système (menu, pied de
 * page, appels à l'action). Les adresses de l'application vivent sous /app.
 */
export const site = {
  name: 'Wema',
  tagline: 'Un prof particulier IA dans chaque matière',
  contactEmail: null as string | null,
  social: {
    linkedin: null as string | null,
    x: null as string | null,
    facebook: null as string | null,
    instagram: null as string | null,
    youtube: null as string | null,
  },
} as const;

/** L'action principale : l'essai gratuit (inscription dans l'application). */
export const videoRequestHref = '/app/inscription';
export const signupHref = videoRequestHref;
export const loginHref = '/app/connexion';
export const contactHref = '/contact';

/** Pas de prise de rendez-vous externe pour l'instant. */
export const demoBookingUrl: string | null = null;
