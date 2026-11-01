import type { Result } from "@wema/domain";
import { err, ok } from "@wema/domain";
import { z } from "zod";
import { AI_TASKS, type AiTask, isAiTask, tierOf } from "./tasks";

/** Identifiant de modèle chez le fournisseur (ex. anthropic/claude-sonnet-5.5). */
const modelId = z.string().regex(/^[a-z0-9][a-z0-9._:/-]{1,120}$/i);
const models = z.array(modelId).min(1).max(5);

/**
 * Routage : fournisseur actif, modèles par palier, et exceptions par tâche.
 * Stocké dans les réglages, modifiable par l'équipe Wema sans toucher au code.
 */
export const aiRoutingSchema = z.object({
  provider: z.enum(["openrouter", "ai-sdk"]),
  tiers: z.object({ reasoning: models, economic: models }),
  tasks: z
    .record(z.string(), models)
    .refine((r) => Object.keys(r).every(isAiTask), {
      message: "tâche inconnue",
    })
    .default({}),
});
export type AiRouting = z.infer<typeof aiRoutingSchema>;

/**
 * Valeurs de départ : le routeur automatique d'OpenRouter, en attendant que
 * l'équipe Wema choisisse ses modèles (réglage `ai_routing`).
 */
export const DEFAULT_ROUTING: AiRouting = {
  provider: "openrouter",
  tiers: { reasoning: ["openrouter/auto"], economic: ["openrouter/auto"] },
  tasks: {},
};

export type RoutingError = {
  kind: "invalid_routing";
  issues: { path: string; message: string }[];
};

export function parseAiRouting(
  input: unknown,
): Result<AiRouting, RoutingError> {
  const parsed = aiRoutingSchema.safeParse(input);
  if (parsed.success) return ok(parsed.data);
  return err({
    kind: "invalid_routing",
    issues: parsed.error.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
    })),
  });
}

/** Modèles d'une tâche : son exception si elle en a une, sinon ceux de son palier. */
export function modelsFor(routing: AiRouting, task: AiTask): readonly string[] {
  return routing.tasks[task] ?? routing.tiers[tierOf(task)];
}

export const ALL_TASKS = Object.keys(AI_TASKS).filter(isAiTask);
