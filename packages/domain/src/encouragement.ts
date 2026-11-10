// Messages d'encouragement (« zone de bienveillance ») : quand en montrer un,
// et lequel. Pas de points ni de séries : un court message, discret, au plus
// un par période. Les textes vivent dans l'interface (vouvoiement).

/** Ce qui peut déclencher un encouragement. */
export type EncouragementTrigger = "success" | "step" | "steady";

/** Au plus un message par période. */
export const ENCOURAGEMENT_PERIOD_MS = 30 * 60 * 1000;
/** Temps de travail actif, d'un seul tenant, qui vaut un encouragement « régularité ». */
export const STEADY_WORK_MS = 20 * 60 * 1000;

/** Messages possibles pour chaque déclencheur (clés des textes de l'interface). */
export const ENCOURAGEMENTS: Readonly<
  Record<EncouragementTrigger, readonly string[]>
> = {
  success: ["success.1", "success.2", "success.3"],
  step: ["step.1", "step.2", "step.3"],
  steady: ["steady.1", "steady.2", "steady.3"],
};

export interface EncouragementInput {
  trigger: EncouragementTrigger;
  now: Date;
  /** Dernier message montré (null : jamais, ou oublié par le navigateur). */
  last: { at: Date; key: string } | null;
  /** Pour « régularité » : temps de travail actif depuis l'arrivée. */
  activeMs?: number;
}

/**
 * Clé du message à montrer, ou null. Jamais deux messages dans la même
 * période ; « régularité » seulement après assez de travail actif. Le message
 * change d'une fois sur l'autre (le suivant dans la liste).
 */
export function chooseEncouragement(input: EncouragementInput): string | null {
  const { trigger, now, last } = input;
  if (
    last &&
    now.getTime() - last.at.getTime() < ENCOURAGEMENT_PERIOD_MS &&
    now.getTime() >= last.at.getTime()
  )
    return null;
  if (trigger === "steady" && (input.activeMs ?? 0) < STEADY_WORK_MS)
    return null;
  const keys = ENCOURAGEMENTS[trigger];
  const previous = last ? keys.indexOf(last.key) : -1;
  return keys[(previous + 1) % keys.length] ?? null;
}
