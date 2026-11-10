/**
 * Aperçu lisible d'un énoncé à emplacements, pour les listes du prof :
 * « Développe l'expression {expression}. » devient
 * « Développe l'expression k(x + a). ». Les paramètres restent des lettres,
 * puisque leurs valeurs ne sont tirées qu'à la déclinaison pour un élève.
 */
export function templatePreview(
  statement: string,
  task: Readonly<Record<string, unknown>>,
): string {
  return statement.replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, (_, name) => {
    const field = task[name];
    return typeof field === "string" ? readableMath(field) : name;
  });
}

/** Écriture de calcul (SymPy) en notation de classe. */
export function readableMath(expr: string): string {
  return expr
    .replace(/\*\*2\b/g, "²")
    .replace(/\*\*3\b/g, "³")
    .replace(/\*\*\(?([^)\s]+)\)?/g, "^$1")
    .replace(/\*\(/g, "(")
    .replace(/\)\*/g, ")")
    .replace(/(\d)\*([a-zA-Z])/g, "$1$2")
    .replace(/\*/g, " × ")
    .replace(/\bsqrt\(/g, "√(");
}
