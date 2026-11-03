import type {
  Country,
  Grade,
  Notion,
  NotionId,
  Program,
  Result,
  Subject,
  Unit,
  UnitId,
} from "@wema/domain";
import { err, ok } from "@wema/domain";

/** Lignes du référentiel d'un pays, telles que lues en base ou dans le jeu d'exemple. */
export interface CurriculumRows {
  country: Country;
  /** Matières communes à tous les pays. */
  subjects: readonly Subject[];
  grades: readonly Grade[];
  programs: readonly Program[];
  units: readonly Unit[];
  notions: readonly Notion[];
}

export interface Curriculum extends CurriculumRows {
  getNotion(id: NotionId): Notion | undefined;
  notionsOfUnit(id: UnitId): readonly Notion[];
}

export type CurriculumError =
  | { kind: "parse"; file: string; message: string }
  | { kind: "duplicate_id"; id: string }
  | { kind: "foreign_row"; id: string; countryId: string }
  | { kind: "unknown_grade"; programId: string; gradeId: string }
  | { kind: "unknown_subject"; programId: string; subjectId: string }
  | { kind: "duplicate_program"; gradeId: string; subjectId: string }
  | { kind: "unknown_program"; unitId: string; programId: string }
  | { kind: "unknown_unit"; notionId: string; unitId: string }
  | { kind: "duplicate_notion_code"; code: string }
  | { kind: "unknown_prerequisite"; notionId: string; prerequisiteId: string }
  | { kind: "archived_prerequisite"; notionId: string; prerequisiteId: string }
  | { kind: "prerequisite_cycle"; cycle: readonly NotionId[] }
  | {
      kind: "duplicate_misconception";
      notionId: string;
      misconceptionId: string;
    };

/**
 * Valide et assemble le référentiel d'un pays. Toutes les erreurs sont
 * accumulées ; un référentiel partiel n'est jamais renvoyé.
 */
export function assembleCurriculum(
  rows: CurriculumRows,
): Result<Curriculum, CurriculumError[]> {
  const errors: CurriculumError[] = [];
  const countryId = rows.country.id;

  const seen = new Set<string>();
  const unique = (id: string) => {
    if (seen.has(id)) errors.push({ kind: "duplicate_id", id });
    seen.add(id);
  };

  const gradeIds = new Set<string>();
  for (const g of rows.grades) {
    unique(g.id);
    if (g.countryId !== countryId) {
      errors.push({ kind: "foreign_row", id: g.id, countryId: g.countryId });
    }
    gradeIds.add(g.id);
  }
  const subjectIds = new Set<string>(rows.subjects.map((s) => s.id));

  const programIds = new Set<string>();
  const gradeSubject = new Set<string>();
  for (const p of rows.programs) {
    unique(p.id);
    programIds.add(p.id);
    if (p.countryId !== countryId) {
      errors.push({ kind: "foreign_row", id: p.id, countryId: p.countryId });
    }
    if (!gradeIds.has(p.gradeId)) {
      errors.push({
        kind: "unknown_grade",
        programId: p.id,
        gradeId: p.gradeId,
      });
    }
    if (!subjectIds.has(p.subjectId)) {
      errors.push({
        kind: "unknown_subject",
        programId: p.id,
        subjectId: p.subjectId,
      });
    }
    const key = `${p.gradeId}/${p.subjectId}`;
    if (gradeSubject.has(key)) {
      errors.push({
        kind: "duplicate_program",
        gradeId: p.gradeId,
        subjectId: p.subjectId,
      });
    }
    gradeSubject.add(key);
  }

  const unitIds = new Set<string>();
  for (const u of rows.units) {
    unique(u.id);
    unitIds.add(u.id);
    if (!programIds.has(u.programId)) {
      errors.push({
        kind: "unknown_program",
        unitId: u.id,
        programId: u.programId,
      });
    }
  }

  const byId = new Map<string, Notion>();
  const codes = new Set<string>();
  for (const n of rows.notions) {
    unique(n.id);
    byId.set(n.id, n);
    if (!unitIds.has(n.unitId)) {
      errors.push({ kind: "unknown_unit", notionId: n.id, unitId: n.unitId });
    }
    if (codes.has(n.code))
      errors.push({ kind: "duplicate_notion_code", code: n.code });
    codes.add(n.code);
    const misconceptions = new Set<string>();
    for (const m of n.misconceptions) {
      if (misconceptions.has(m.id)) {
        errors.push({
          kind: "duplicate_misconception",
          notionId: n.id,
          misconceptionId: m.id,
        });
      }
      misconceptions.add(m.id);
    }
  }

  for (const n of rows.notions) {
    for (const p of n.prerequisites) {
      if (!byId.has(p)) {
        errors.push({
          kind: "unknown_prerequisite",
          notionId: n.id,
          prerequisiteId: p,
        });
      }
    }
  }
  for (const cycle of findCycles(byId)) {
    errors.push({ kind: "prerequisite_cycle", cycle });
  }

  if (errors.length > 0) return err(errors);

  const byUnit = new Map<string, Notion[]>();
  for (const n of [...rows.notions].sort((a, b) => a.position - b.position)) {
    byUnit.set(n.unitId, [...(byUnit.get(n.unitId) ?? []), n]);
  }
  return ok({
    ...rows,
    getNotion: (id) => byId.get(id),
    notionsOfUnit: (id) => byUnit.get(id) ?? [],
  });
}

/**
 * Vérifie qu'on peut donner ces prérequis à une notion du référentiel :
 * notions connues du même pays, non archivées, sans créer de cycle.
 */
export function checkPrerequisiteChange(
  curriculum: Curriculum,
  notionId: NotionId,
  prerequisites: readonly NotionId[],
): Result<void, CurriculumError[]> {
  const errors: CurriculumError[] = [];
  const notion = curriculum.getNotion(notionId);
  if (!notion) {
    return err([
      { kind: "unknown_prerequisite", notionId, prerequisiteId: notionId },
    ]);
  }
  for (const p of prerequisites) {
    const target = curriculum.getNotion(p);
    if (!target) {
      errors.push({
        kind: "unknown_prerequisite",
        notionId,
        prerequisiteId: p,
      });
    } else if (target.archived && !notion.prerequisites.includes(p)) {
      errors.push({
        kind: "archived_prerequisite",
        notionId,
        prerequisiteId: p,
      });
    }
  }
  if (errors.length > 0) return err(errors);

  const byId = new Map<string, Notion>(
    curriculum.notions.map((n) => [
      n.id,
      n.id === notionId ? { ...n, prerequisites } : n,
    ]),
  );
  const cycles = findCycles(byId);
  return cycles.length > 0
    ? err(cycles.map((cycle) => ({ kind: "prerequisite_cycle", cycle })))
    : ok(undefined);
}

/** Parcours en profondeur à trois couleurs ; un cycle par arc retour trouvé. */
function findCycles(byId: ReadonlyMap<string, Notion>): NotionId[][] {
  const state = new Map<string, "visiting" | "done">();
  const stack: NotionId[] = [];
  const cycles: NotionId[][] = [];

  const visit = (id: NotionId): void => {
    state.set(id, "visiting");
    stack.push(id);
    for (const p of byId.get(id)?.prerequisites ?? []) {
      if (!byId.has(p)) continue;
      const s = state.get(p);
      if (s === "visiting") cycles.push(stack.slice(stack.indexOf(p)));
      else if (s === undefined) visit(p);
    }
    stack.pop();
    state.set(id, "done");
  };

  for (const n of byId.values()) {
    if (!state.has(n.id)) visit(n.id);
  }
  return cycles;
}
