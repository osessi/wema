import type { CanonicalAnswer, RenderedMath, Result } from "@wema/domain";
import { err, ok } from "@wema/domain";

// Contrôle d'une reformulation (BD, lecture facile) : la forme change, les
// données mathématiques non. Une reformulation qui perd, change ou ajoute un
// nombre, ou qui laisse voir la réponse, est écartée : on garde le texte vérifié.

export type FaithfulnessError =
  /** Une formule de l'énoncé n'apparaît plus telle quelle. */
  | { kind: "formula_missing"; formula: string }
  /** Un nombre de l'énoncé manque (ou apparaît moins de fois). */
  | { kind: "number_missing"; number: string }
  /** Un nombre absent de l'énoncé a été ajouté. */
  | { kind: "number_added"; number: string }
  /** La reformulation contient la réponse attendue. */
  | { kind: "answer_leaked" };

/** Écriture comparable : tirets et signes unifiés, sans espaces. */
function compact(text: string): string {
  return text.replace(/[−–‐]/g, "-").replace(/[×·]/g, "*").replace(/\s+/g, "");
}

/** Nombres écrits en chiffres (3, 12, 4,5 ou 4.5), dans l'ordre du texte. */
export function extractNumbers(text: string): string[] {
  const found = text.match(/\d+(?:[.,]\d+)?/g) ?? [];
  return found.map((n) => {
    const normalized = n.replace(",", ".");
    // 007 et 7 désignent le même nombre ; 4.50 et 4.5 aussi.
    const [whole = "0", decimals] = normalized.split(".");
    const w = whole.replace(/^0+(?=\d)/, "");
    const d = decimals?.replace(/0+$/, "");
    return d ? `${w}.${d}` : w;
  });
}

function counts(values: readonly string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const v of values) map.set(v, (map.get(v) ?? 0) + 1);
  return map;
}

/** Valeurs de la réponse attendue, sous une forme qu'on peut chercher dans un texte. */
function answerNeedles(answer: CanonicalAnswer): string[] {
  if (answer.kind === "solutions")
    return answer.values.map((v) => compact(`${answer.variable}=${v}`));
  if (answer.kind === "expression") return [compact(answer.value)];
  return [];
}

/**
 * Vérifie qu'une reformulation garde les données de l'énoncé vérifié :
 * - chaque formule rendue par services/math est recopiée telle quelle ;
 * - chaque nombre de l'énoncé est présent, au moins autant de fois ;
 * - aucun nombre nouveau n'apparaît (il pourrait changer l'exercice ou
 *   donner la réponse) ;
 * - la réponse attendue n'apparaît pas.
 */
export function checkFaithful(input: {
  statement: string;
  rendered: Readonly<Record<string, RenderedMath>>;
  answer: CanonicalAnswer;
  produced: readonly string[];
}): Result<void, FaithfulnessError> {
  const produced = input.produced.join("\n");
  const flat = compact(produced);

  // Formules réellement présentes dans l'énoncé (equation, expression…).
  const formulas = Object.values(input.rendered)
    .map((r) => r.text)
    .filter((t) => t.length > 0 && input.statement.includes(t));
  for (const formula of formulas) {
    if (!flat.includes(compact(formula)))
      return err({ kind: "formula_missing", formula });
  }

  const expected = counts(extractNumbers(input.statement));
  const got = counts(extractNumbers(produced));
  for (const [number, n] of expected) {
    if ((got.get(number) ?? 0) < n)
      return err({ kind: "number_missing", number });
  }
  for (const number of got.keys()) {
    if (!expected.has(number)) return err({ kind: "number_added", number });
  }

  // La réponse ne doit pas se lire dans la reformulation, une fois les
  // formules de l'énoncé retirées (« 3x = 12 » n'est pas « x = 4 »).
  let rest = flat;
  for (const formula of formulas) rest = rest.split(compact(formula)).join("|");
  if (answerNeedles(input.answer).some((needle) => rest.includes(needle)))
    return err({ kind: "answer_leaked" });
  if (input.answer.kind === "number") {
    const value = extractNumbers(input.answer.value)[0];
    if (value !== undefined && !expected.has(value) && got.has(value))
      return err({ kind: "answer_leaked" });
  }
  return ok(undefined);
}
