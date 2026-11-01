/**
 * Palier d'une tâche : `reasoning` pour expliquer, corriger, conduire
 * l'entretien ; `economic` pour les relances et les textes courts.
 */
export type AiTier = "reasoning" | "economic";

/** Catalogue fermé des tâches confiées à l'IA. */
export const AI_TASKS = {
  "tutor.reply": "reasoning",
  "tutor.hint": "reasoning",
  "answer.analyze": "reasoning",
  "intake.interview": "reasoning",
  "profile.summarize": "economic",
  "nudge.write": "economic",
  "exercise.contextualize": "economic",
} as const satisfies Record<string, AiTier>;

export type AiTask = keyof typeof AI_TASKS;

export function isAiTask(value: string): value is AiTask {
  return Object.hasOwn(AI_TASKS, value);
}

export function tierOf(task: AiTask): AiTier {
  return AI_TASKS[task];
}
