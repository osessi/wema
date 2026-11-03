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
  "session.assess": "reasoning",
  /** Relecture d'une copie photographiée (message avec image). */
  "copy.review": "reasoning",
  /** Propositions d'exercices de la banque hebdomadaire (vérifiées ensuite par services/math). */
  "exercise.propose": "reasoning",
  "profile.summarize": "economic",
  "nudge.write": "economic",
  "exercise.contextualize": "economic",
  /** Énoncé mis en bande dessinée (nombres contrôlés ensuite, sinon on garde le texte). */
  "exercise.comics": "economic",
  /** Énoncé en lecture facile : phrases courtes (nombres contrôlés ensuite). */
  "exercise.simplify": "economic",
} as const satisfies Record<string, AiTier>;

export type AiTask = keyof typeof AI_TASKS;

export function isAiTask(value: string): value is AiTask {
  return Object.hasOwn(AI_TASKS, value);
}

export function tierOf(task: AiTask): AiTier {
  return AI_TASKS[task];
}
