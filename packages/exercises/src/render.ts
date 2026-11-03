import type { RenderedMath, Result } from "@wema/domain";
import { err, ok } from "@wema/domain";

export type RenderError = { kind: "unknown_placeholder"; name: string };

/**
 * Remplace les emplacements {nom} d'un modèle : un champ mathématique rendu
 * par services/math (ex. {equation}) ou la valeur d'un paramètre (ex. {a}).
 */
export function renderTemplate(
  template: string,
  parameters: Readonly<Record<string, number>>,
  rendered: Readonly<Record<string, RenderedMath>>,
): Result<string, RenderError> {
  let missing: string | null = null;
  const text = template.replace(/\{([a-z]{1,12})\}/g, (whole, name: string) => {
    const math = rendered[name];
    if (math) return math.text;
    const value = parameters[name];
    if (value !== undefined) return value < 0 ? `(${value})` : String(value);
    missing ??= name;
    return whole;
  });
  return missing === null
    ? ok(text)
    : err({ kind: "unknown_placeholder", name: missing });
}
