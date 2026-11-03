import type { NotionId } from "@wema/domain";
import type { NextAction } from "./next-actions";

/** Actions qui se travaillent par un exercice sur leur notion. */
const PRACTICE_KINDS: ReadonlySet<NextAction["kind"]> = new Set([
  "easy_win",
  "prerequisite_first",
  "misconception_focus",
  "spaced_review",
  "practice",
  "start_notion",
]);

export interface PersonalPracticeInput {
  /** Prochaines actions de l'élève, dans l'ordre de `nextActions`. */
  actions: readonly NextAction[];
  /** Exercices validés qu'il peut recevoir (bibliothèque Wema, sa famille). */
  intents: readonly {
    id: string;
    notionId: NotionId;
    misconceptionId: string | null;
  }[];
  /** Variantes déjà reçues de chaque exercice : on varie les exercices. */
  used: ReadonlyMap<string, number>;
  /** Notions qu'il peut travailler (matière ouverte, programme suivi). */
  allowedNotions: ReadonlySet<string>;
}

export interface PersonalPractice {
  intentId: string;
  notionId: NotionId;
  kind: NextAction["kind"];
}

/**
 * Exercice personnel à préparer pour un élève qui n'a pas de prof pour lui en
 * donner (programme individuel) : la première action utile qui a un exercice
 * validé sur sa notion. Jamais quand un exercice ou un devoir attend déjà une
 * réponse (un exercice ouvert à la fois). Sur une idée fausse, un exercice qui
 * la cible passe d'abord ; ensuite le moins souvent reçu, puis par identifiant
 * (résultat stable). Fonction pure.
 */
export function choosePersonalPractice(
  input: PersonalPracticeInput,
): PersonalPractice | null {
  if (input.actions.some((a) => "variantId" in a)) return null;
  for (const action of input.actions) {
    if (!PRACTICE_KINDS.has(action.kind) || !("notionId" in action)) continue;
    if (!input.allowedNotions.has(action.notionId)) continue;
    const candidates = input.intents.filter(
      (i) => i.notionId === action.notionId,
    );
    if (candidates.length === 0) continue;
    const target =
      action.kind === "misconception_focus" ? action.misconceptionId : null;
    const best = [...candidates].sort(
      (a, b) =>
        Number(b.misconceptionId === target && target !== null) -
          Number(a.misconceptionId === target && target !== null) ||
        (input.used.get(a.id) ?? 0) - (input.used.get(b.id) ?? 0) ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    )[0];
    if (best)
      return {
        intentId: best.id,
        notionId: action.notionId,
        kind: action.kind,
      };
  }
  return null;
}
