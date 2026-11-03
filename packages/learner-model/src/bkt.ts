/** Paramètres du Bayesian Knowledge Tracing. */
export interface BktParams {
  /** Probabilité de maîtrise avant toute observation. */
  pInit: number;
  /** Probabilité d'apprendre la notion à chaque occasion. */
  pLearn: number;
  /** Probabilité de se tromper alors que la notion est maîtrisée. */
  pSlip: number;
  /** Probabilité de répondre juste sans maîtriser. */
  pGuess: number;
}

export const DEFAULT_BKT: BktParams = {
  pInit: 0.2,
  pLearn: 0.15,
  pSlip: 0.1,
  pGuess: 0.2,
};

/**
 * Plafond de la maîtrise estimée. Sans lui, après une vingtaine de bonnes
 * réponses le calcul en virgule flottante arrondit la maîtrise à 1, et une
 * maîtrise de 1 ne baisse plus jamais (une erreur y est « impossible ») : la
 * notion resterait validée malgré toutes les erreurs suivantes. Au plafond,
 * 4 erreurs d'affilée la font repasser sous le seuil « Validé » par défaut.
 */
export const MASTERY_CEILING = 0.9999;

/** Probabilité de maîtrise après une réponse, puis l'occasion d'apprendre. */
export function updateMastery(
  pKnown: number,
  correct: boolean,
  { pLearn, pSlip, pGuess }: BktParams,
): number {
  const posterior = correct
    ? (pKnown * (1 - pSlip)) / (pKnown * (1 - pSlip) + (1 - pKnown) * pGuess)
    : (pKnown * pSlip) / (pKnown * pSlip + (1 - pKnown) * (1 - pGuess));
  return Math.min(MASTERY_CEILING, posterior + (1 - posterior) * pLearn);
}
