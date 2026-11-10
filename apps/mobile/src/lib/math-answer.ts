/**
 * Réponse au format lu par services/math, comme sur le web (MathLive en
 * « ascii-math ») : x=3, sqrt(2), (7)/(2), x^2… Le texte libre (« ou ») est
 * gardé tel quel. Les touches de l'appli écrivent des symboles lisibles
 * (×, ÷, −, √, ²), traduits ici.
 */
export function toAnswerText(display: string): string {
  return display
    .replace(/√\s*\(/g, "sqrt(")
    .replace(/√\s*([0-9a-zA-Z.,]+)/g, "sqrt($1)")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/[−–]/g, "-")
    .replace(/≤/g, "<=")
    .replace(/≥/g, ">=")
    .replace(/\s+/g, " ")
    .trim();
}

/** Touches du clavier mathématique : ce qui est affiché et ce qui est inséré. */
export interface MathKey {
  label: string;
  insert: string;
  /** Recul du curseur après insertion (pour se placer entre les parenthèses). */
  back?: number;
  /** Nom lu par le lecteur d'écran, si le symbole ne suffit pas. */
  a11y?: "sqrt" | "power" | "fraction" | "or";
}

export const MATH_KEYS: readonly MathKey[][] = [
  [
    { label: "x", insert: "x" },
    { label: "y", insert: "y" },
    { label: "=", insert: " = " },
    { label: "(", insert: "(" },
    { label: ")", insert: ")" },
    { label: ",", insert: "," },
  ],
  [
    { label: "+", insert: " + " },
    { label: "−", insert: " − " },
    { label: "×", insert: " × " },
    { label: "÷", insert: " ÷ " },
    { label: "a/b", insert: "()/()", back: 4, a11y: "fraction" },
    { label: "x²", insert: "²" },
  ],
  [
    { label: "xⁿ", insert: "^", a11y: "power" },
    { label: "√", insert: "√()", back: 1, a11y: "sqrt" },
    { label: "<", insert: " < " },
    { label: ">", insert: " > " },
    { label: "ou", insert: " ou ", a11y: "or" },
  ],
];

/** Insère `text` à la place de la sélection ; renvoie le texte et la nouvelle position du curseur. */
export function insertAt(
  value: string,
  selection: { start: number; end: number },
  key: MathKey,
): { value: string; cursor: number } {
  const start = Math.max(0, Math.min(selection.start, value.length));
  const end = Math.max(start, Math.min(selection.end, value.length));
  const next = value.slice(0, start) + key.insert + value.slice(end);
  return { value: next, cursor: start + key.insert.length - (key.back ?? 0) };
}

/** Efface le caractère avant le curseur (ou la sélection). */
export function eraseAt(
  value: string,
  selection: { start: number; end: number },
): { value: string; cursor: number } {
  const start = Math.max(0, Math.min(selection.start, value.length));
  const end = Math.max(start, Math.min(selection.end, value.length));
  if (start !== end)
    return { value: value.slice(0, start) + value.slice(end), cursor: start };
  if (start === 0) return { value, cursor: 0 };
  return {
    value: value.slice(0, start - 1) + value.slice(start),
    cursor: start - 1,
  };
}
