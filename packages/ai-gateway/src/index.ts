/**
 * @wema/ai-gateway
 *
 * Porte unique vers les modèles d'IA (AGENTS.md, règle 5) : interface commune,
 * deux branchements interchangeables (OpenRouter, Vercel AI SDK), modèles
 * choisis par tâche, données personnelles masquées, chaque appel journalisé
 * avec son coût.
 */
export * from "./ai-sdk";
export * from "./gateway";
export * from "./openrouter";
export * from "./privacy";
export * from "./routing";
export * from "./tasks";
export * from "./types";
