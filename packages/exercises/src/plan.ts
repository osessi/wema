import type { ExerciseIntent, VariantPlan } from "@wema/domain";
import type { LearnerModelSettings, NotionState } from "@wema/learner-model";
import { DEFAULT_SETTINGS } from "@wema/learner-model";

/** Observations à partir desquelles une maîtrise basse signale une vraie difficulté. */
const STRUGGLING_AFTER = 3;

/**
 * Avantage collectif minimal des étapes guidées (écart de réussite à la
 * réponse suivante, sur tous les élèves) pour guider aussi un élève « en cours ».
 */
export const COLLECTIVE_SCAFFOLDING_GAIN = 0.15;

/** Ce que l'apprentissage collectif anonymisé dit de la notion (null : pas assez d'élèves). */
export interface CollectiveHint {
  /** Réussite après une variante guidée moins réussite après une non guidée. */
  scaffoldingGain: number | null;
}

/**
 * Forme de la variante pour un élève, selon son état sur la notion :
 * - notion jamais vue : nombres simples, étapes guidées, un indice ;
 * - maîtrise basse : nombres simples, étapes guidées, plus d'indices s'il bute ;
 * - en cours : nombres intermédiaires, sans guidage, un indice ;
 * - candidate à la validation : nombres plus exigeants, sans indice.
 * Si l'exercice cible une idée fausse encore active chez l'élève, on guide
 * par étapes pour que l'erreur se montre et se corrige. Si, sur l'ensemble
 * des élèves, les étapes guidées font nettement mieux progresser sur cette
 * notion, un élève « en cours » est guidé lui aussi (jamais un candidat à la
 * validation, qui doit réussir seul).
 */
export function planVariant(
  intent: Pick<ExerciseIntent, "misconceptionId">,
  state: NotionState | undefined,
  settings: LearnerModelSettings = DEFAULT_SETTINGS,
  collective: CollectiveHint | null = null,
): VariantPlan {
  let plan: VariantPlan;
  if (!state) {
    plan = { level: 1, scaffolded: true, hintLevel: 1 };
  } else if (state.pKnown < settings.inProgressThreshold) {
    plan = {
      level: 1,
      scaffolded: true,
      hintLevel: state.observations >= STRUGGLING_AFTER ? 2 : 1,
    };
  } else if (state.pKnown < settings.masteryThreshold) {
    const guided =
      (collective?.scaffoldingGain ?? 0) >= COLLECTIVE_SCAFFOLDING_GAIN;
    plan = { level: 2, scaffolded: guided, hintLevel: 1 };
  } else {
    plan = { level: 3, scaffolded: false, hintLevel: 0 };
  }
  const targeted =
    intent.misconceptionId !== null &&
    state?.misconceptions.some(
      (m) => m.active && m.misconceptionId === intent.misconceptionId,
    );
  return targeted ? { ...plan, scaffolded: true } : plan;
}
