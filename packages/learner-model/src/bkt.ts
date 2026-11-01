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

/** Probabilité de maîtrise après une réponse, puis l'occasion d'apprendre. */
export function updateMastery(
  pKnown: number,
  correct: boolean,
  { pLearn, pSlip, pGuess }: BktParams,
): number {
  const posterior = correct
    ? (pKnown * (1 - pSlip)) / (pKnown * (1 - pSlip) + (1 - pKnown) * pGuess)
    : (pKnown * pSlip) / (pKnown * pSlip + (1 - pKnown) * (1 - pGuess));
  return posterior + (1 - posterior) * pLearn;
}
