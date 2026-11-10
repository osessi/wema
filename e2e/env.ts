// Environnement des tests e2e, séparé du développement : base wema_e2e, API
// sur :4100, web sur :3100. services/math est partagé (sans état).

export const API_PORT = Number(process.env.E2E_API_PORT ?? 4100);
export const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 3100);
export const WEB_URL = `http://localhost:${WEB_PORT}`;
/**
 * Chemin de l'application (basePath du web, /app par défaut comme en
 * production) ; l'API reste à la racine (/api), le site public aussi (/).
 */
export const APP_PATH = "/app";
/** Adresse d'une page de l'application, pour `page.goto`. */
export const app = (path: string) => `${APP_PATH}${path}`;
export const API_URL = `http://localhost:${API_PORT}`;
export const MATH_URL = process.env.E2E_MATH_URL ?? "http://localhost:8000";
export const DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  "postgres://wema:wema@localhost:5432/wema_e2e";

/** Super admin créé au démarrage de l'API (comptes fictifs, domaine .test). */
export const ADMIN = {
  email: "admin@wema.test",
  password: "e2e-admin-wema-2026",
};
/** Mot de passe des comptes du jeu de démonstration (seed-demo.ts). */
export const DEMO_PASSWORD = "demo-wema-2026";

/** Variables de l'API : explicites, sans le .env de développement. */
export const apiEnv: Record<string, string> = {
  NODE_ENV: "development",
  PORT: String(API_PORT),
  DATABASE_URL,
  WEMA_PUBLIC_URL: WEB_URL,
  WEMA_MATH_URL: MATH_URL,
  WEMA_SUPER_ADMIN_EMAIL: ADMIN.email,
  WEMA_SUPER_ADMIN_PASSWORD: ADMIN.password,
  WEMA_SUPER_ADMIN_NAME: "Admin e2e",
  // Jamais d'appel à la vraie IA : l'interface doit gérer « IA indisponible ».
  OPENROUTER_API_KEY: "",
};
