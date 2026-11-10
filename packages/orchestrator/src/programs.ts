import type { SubjectId } from "@wema/domain";

/**
 * Programmes que suit vraiment un élève : ceux de ses classes, puis ses
 * programmes individuels (choisis par son parent) pour les matières qu'aucune
 * classe ne couvre. Pour une matière donnée, la classe reste prioritaire :
 * le prof de la classe pilote le programme (fiche 0010). L'ordre est gardé.
 */
export function effectivePrograms<
  T extends { subjectId: SubjectId; source: "class" | "individual" },
>(programs: readonly T[]): T[] {
  const byClass = new Set(
    programs.filter((p) => p.source === "class").map((p) => p.subjectId),
  );
  const individual = new Set<SubjectId>();
  const classes = programs.filter((p) => p.source === "class");
  const own = programs.filter((p) => {
    if (p.source !== "individual" || byClass.has(p.subjectId)) return false;
    // Un seul programme individuel par matière (le premier).
    if (individual.has(p.subjectId)) return false;
    individual.add(p.subjectId);
    return true;
  });
  return [...classes, ...own];
}
