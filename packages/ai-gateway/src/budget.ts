import type { AiTask } from "./tasks";
import type { AiContext } from "./types";

/**
 * Tâches essentielles : un élève attend la réponse en direct (prof IA,
 * analyse de sa réponse, entretien, copie). Elles ne sont jamais bloquées par
 * un plafond de dépense. Toutes les autres (banque, relances, reformulations,
 * synthèses) le sont au-delà du plafond ; une nouvelle tâche est non
 * essentielle tant qu'elle n'est pas ajoutée ici.
 */
export const ESSENTIAL_AI_TASKS: readonly AiTask[] = [
  "tutor.reply",
  "tutor.hint",
  "answer.analyze",
  "intake.interview",
  "session.assess",
  "copy.review",
];

export function isEssentialTask(task: AiTask): boolean {
  return ESSENTIAL_AI_TASKS.includes(task);
}

export interface SpendingCapRule {
  monthlyUsd: number;
  /** Part du plafond qui déclenche une alerte, de 0 à 1. */
  alertRatio: number;
}

export type SpendingLevel = "ok" | "warning" | "blocked";

export interface ScopeVerdict {
  scope: "global" | "organization";
  level: SpendingLevel;
  spentUsd: number;
  capUsd: number;
}

/** État d'une portée par rapport à son plafond (pas de plafond : toujours « ok »). */
export function spendingLevel(
  spentUsd: number,
  cap: SpendingCapRule | null,
): SpendingLevel {
  if (!cap) return "ok";
  if (spentUsd >= cap.monthlyUsd) return "blocked";
  if (spentUsd >= cap.monthlyUsd * cap.alertRatio) return "warning";
  return "ok";
}

/** Verdict pour un appel : chaque portée plafonnée, et si l'appel doit être bloqué. */
export function spendingVerdict(input: {
  task: AiTask;
  spent: { global: number; organization: number | null };
  caps: {
    global: SpendingCapRule | null;
    organization: SpendingCapRule | null;
  };
}): { block: boolean; scopes: ScopeVerdict[] } {
  const scopes: ScopeVerdict[] = [];
  if (input.caps.global) {
    scopes.push({
      scope: "global",
      level: spendingLevel(input.spent.global, input.caps.global),
      spentUsd: input.spent.global,
      capUsd: input.caps.global.monthlyUsd,
    });
  }
  if (input.caps.organization && input.spent.organization !== null) {
    scopes.push({
      scope: "organization",
      level: spendingLevel(input.spent.organization, input.caps.organization),
      spentUsd: input.spent.organization,
      capUsd: input.caps.organization.monthlyUsd,
    });
  }
  const over = scopes.some((s) => s.level === "blocked");
  return { block: over && !isEssentialTask(input.task), scopes };
}

/**
 * Contrôle de dépense branché sur la passerelle : appelé avant chaque appel
 * non essentiel ; « vrai » bloque l'appel (erreur `budget_exceeded`).
 */
export type SpendingGuard = (
  task: AiTask,
  context: AiContext,
) => Promise<{ block: boolean }>;
