import { faq } from '../../lib/faq';

export interface FaqItem {
  readonly question: string;
  readonly answer: string;
}

/** Les questions qui décident d'un essai ; le reste est sur la page dédiée. */
const PICKED = [0, 1, 2, 3, 7, 8, 9];

export const faqLanding: readonly FaqItem[] = PICKED.flatMap((i) => {
  const item = faq[i];
  return item ? [{ question: item.q, answer: item.a }] : [];
});
