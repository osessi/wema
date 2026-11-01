/**
 * @wema/api
 *
 * Serveur : API pour les applis (connexion, administration), plus tard les
 * webhooks des canaux et les tâches planifiées. Assemble les paquets du cœur,
 * sans logique pédagogique propre.
 */
export { type AppType, createApp } from "./app";
export type { Deps } from "./context";
