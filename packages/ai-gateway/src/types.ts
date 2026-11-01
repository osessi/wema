import type { Result } from "@wema/domain";
import type { AiTask } from "./tasks";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Contexte d'un appel, pour le journal des coûts. Jamais de nom ni de coordonnées. */
export interface AiContext {
  organizationId: string | null;
  /** Identifiant technique (UUID) de l'élève concerné, s'il y en a un. */
  learnerId: string | null;
}

export interface AiRequest {
  task: AiTask;
  messages: readonly ChatMessage[];
  context: AiContext;
  temperature?: number;
  maxTokens?: number;
}

export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
  /** Coût en dollars annoncé par le fournisseur, s'il le donne. */
  costUsd: number | null;
}

export interface AiTextResult {
  text: string;
  /** Modèle réellement utilisé (un modèle de secours a pu répondre). */
  model: string;
  provider: ProviderName;
  usage: AiUsage;
  latencyMs: number;
}

export type AiErrorKind =
  /** Trop de requêtes chez le fournisseur. */
  | "rate_limited"
  /** Fournisseur ou modèle indisponible, délai dépassé. */
  | "unavailable"
  /** Requête refusée (modération, garde-fou, crédits épuisés). */
  | "refused"
  /** Réponse illisible ou qui ne respecte pas le schéma demandé. */
  | "invalid_output"
  /** Configuration incorrecte (clé absente ou invalide, modèle inconnu). */
  | "misconfigured";

export interface AiError {
  kind: AiErrorKind;
  message: string;
  /** Vrai si une nouvelle tentative a des chances d'aboutir. */
  retryable: boolean;
}

export type ProviderName = "openrouter" | "ai-sdk";

/** Ce que la passerelle demande à un branchement. */
export interface ProviderRequest {
  /** Modèles par ordre de préférence : le premier, puis les secours. */
  models: readonly string[];
  messages: readonly ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  /** Sortie structurée : schéma JSON que la réponse doit respecter. */
  json?: { name: string; schema: Record<string, unknown> };
}

export interface ProviderResult {
  text: string;
  model: string;
  usage: AiUsage;
}

/** Un branchement vers un fournisseur ; OpenRouter et Vercel AI SDK font les mêmes choses. */
export interface AiProvider {
  name: ProviderName;
  generate(request: ProviderRequest): Promise<Result<ProviderResult, AiError>>;
  /** Comme `generate`, en transmettant le texte au fil de l'eau. */
  stream(
    request: ProviderRequest,
    onDelta: (delta: string) => void,
  ): Promise<Result<ProviderResult, AiError>>;
}
