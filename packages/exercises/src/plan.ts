import type { ExerciseIntent, VariantPlan } from "@wema/domain";
import type { LearnerModelSettings, NotionState } from "@wema/learner-model";
import { DEFAULT_SETTINGS } from "@wema/learner-model";

/** Observations à partir desquelles une maîtrise basse signale une vraie difficulté. */
const STRUGGLING_AFTER = 3;

/**
 * Forme de la variante pour un élève, selon son état sur la notion :
 * - notion jamais vue : nombres simples, étapes guidées, un indice ;
 * - maîtrise basse : nombres simples, étapes guidées, plus d'indices s'il bute ;
 * - en cours : nombres intermédiaires, sans guidage, un indice ;
 * - candidate à la validation : nombres plus exigeants, sans indice.
 * Si l'exercice cible une idée fausse encore active chez l'élève, on guide
 * par étapes pour que l'erreur se montre et se corrige.
 */
export function planVariant(
  intent: Pick<ExerciseIntent, "misconceptionId">,
  state: NotionState | undefined,
  settings: LearnerModelSettings = DEFAULT_SETTINGS,
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
    plan = { level: 2, scaffolded: false, hintLevel: 1 };
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
