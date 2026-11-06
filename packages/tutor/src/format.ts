// Mise en forme d'une réponse du prof IA avant qu'elle soit contrôlée,
// enregistrée et montrée (ou lue à voix haute) : texte simple, sans Markdown
// ni LaTeX, et jamais coupé au milieu d'une phrase.

const SUPERSCRIPTS: Record<string, string> = { "2": "²", "3": "³" };

/** Remplace les écritures LaTeX usuelles par des symboles simples (√, ×, ², ≈). */
function latexToText(s: string): string {
  let out = s;
  for (let i = 0; i < 3; i++) {
    out = out
      .replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, "$1/$2")
      .replace(/\\sqrt\{([^{}]*)\}/g, (_m, inner: string) =>
        /^[\w.,]+$/.test(inner) ? `√${inner}` : `√(${inner})`,
      )
      .replace(/\\text\{([^{}]*)\}/g, "$1")
      .replace(
        /\^\{([^{}]*)\}/g,
        (_m, p: string) => SUPERSCRIPTS[p] ?? `^${p}`,
      );
  }
  return out
    .replace(/\\left|\\right/g, "")
    .replace(/\\(times|cdot)/g, "×")
    .replace(/\\approx/g, "≈")
    .replace(/\\pm/g, "±")
    .replace(/\\(neq|ne)(?![a-z])/g, "≠")
    .replace(/\\(leq|le)(?![a-z])/g, "≤")
    .replace(/\\(geq|ge)(?![a-z])/g, "≥")
    .replace(/\\sqrt/g, "√")
    .replace(/\^([23])(?![\d])/g, (_m, p: string) => SUPERSCRIPTS[p] ?? p)
    .replace(/\\[,;:! ]/g, " ")
    .replace(/\\[()[\]]/g, "");
}

/**
 * Texte simple : retire le gras, les titres et les délimiteurs mathématiques
 * ($…$, \(…\)), et traduit le LaTeX usuel. Le contenu n'est pas modifié.
 */
export function toPlainText(text: string): string {
  return latexToText(text.replace(/\$\$?/g, ""))
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[*•]\s+/gm, "- ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Réponse coupée par la limite de longueur : on garde les phrases complètes.
 * Rien de complet : chaîne vide (l'appelant régénère ou se replie).
 */
export function dropUnfinishedSentence(text: string): string {
  const trimmed = text.trimEnd();
  const ends = [...trimmed.matchAll(/[.!?…»)](?=\s|$)/g)];
  const last = ends.at(-1);
  return last ? trimmed.slice(0, (last.index ?? 0) + 1).trim() : "";
}

/** Texte final d'une réponse : texte simple, sans phrase coupée. */
export function finalText(text: string, truncated: boolean): string {
  const plain = toPlainText(text);
  return truncated ? dropUnfinishedSentence(plain) : plain;
}
