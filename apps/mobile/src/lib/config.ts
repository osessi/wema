import Constants from "expo-constants";

/**
 * Adresse du serveur API (sans /api). `EXPO_PUBLIC_WEMA_API_URL` l'emporte ;
 * sinon, en développement, l'ordinateur qui fait tourner Expo (celui qui sert
 * l'appli au téléphone), port 4000.
 */
export function apiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_WEMA_API_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  return `http://${host && host.length > 0 ? host : "localhost"}:4000`;
}

/**
 * Adresse de l'application web, chemin /app compris (pages légales :
 * /app/conditions…). `EXPO_PUBLIC_WEMA_WEB_URL` l'emporte (ex.
 * https://wema.winneragency.co/app) ; sinon, en développement, le même
 * ordinateur que l'API, port 3000, sous /app.
 */
export function webBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_WEMA_WEB_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  return `http://${host && host.length > 0 ? host : "localhost"}:3000/app`;
}
