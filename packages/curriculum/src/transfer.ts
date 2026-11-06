import { randomUUID } from "node:crypto";
import type {
  Grade,
  Misconception,
  Notion,
  NotionId,
  Program,
  Result,
  Unit,
} from "@wema/domain";
import {
  asGradeId,
  asMisconceptionId,
  asNotionId,
  asProgramId,
  asUnitId,
  err,
  ok,
} from "@wema/domain";
import { parse, stringify } from "yaml";
import { z } from "zod";
import {
  assembleCurriculum,
  type CurriculumError,
  type CurriculumRows,
} from "./assemble";
import { countrySchema, programSchema } from "./seed";

/**
 * Import et export du référentiel d'un pays (back-office) :
 * - YAML au format de content/curriculum : soit un fichier de programme
 *   (grade, subject, units), soit le pays complet (country.yaml + `programs`) ;
 * - CSV simple des notions, une ligne par notion.
 * Un import ne supprime ni n'archive rien : il crée ce qui manque et met à
 * jour les notions (désignées par leur code), après validation complète.
 */

export type ProgramDoc = z.infer<typeof programSchema>;

const countryDocSchema = countrySchema.extend({
  programs: z.array(programSchema).default([]),
});
export type CountryDoc = z.infer<typeof countryDocSchema>;

export type ImportFormat = "yaml" | "csv";

export type ImportIssue =
  | CurriculumError
  | { kind: "csv"; line: number; message: string }
  | { kind: "unknown_subject"; subject: string }
  | { kind: "country_mismatch"; expected: string; found: string }
  | { kind: "duplicate_code_in_file"; code: string }
  | { kind: "empty" };

/** Colonnes du CSV des notions, dans l'ordre. Listes séparées par « | ». */
export const NOTION_CSV_COLUMNS = [
  "classe",
  "matiere",
  "unite",
  "code",
  "nom",
  "description",
  "prerequis",
  "idees_fausses",
] as const;

const live = <T extends { archived: boolean }>(rows: readonly T[]) =>
  rows.filter((r) => !r.archived);

// --- Export ------------------------------------------------------------------

function programDocs(rows: CurriculumRows): ProgramDoc[] {
  const grades = new Map(rows.grades.map((g) => [g.id, g]));
  const subjects = new Map(rows.subjects.map((s) => [s.id, s]));
  const codeOf = new Map(rows.notions.map((n) => [n.id, n.code]));
  const position = (gradeId: Grade["id"]) => grades.get(gradeId)?.position ?? 0;
  return live(rows.programs)
    .sort(
      (a, b) =>
        position(a.gradeId) - position(b.gradeId) ||
        (subjects.get(a.subjectId)?.code ?? "").localeCompare(
          subjects.get(b.subjectId)?.code ?? "",
        ),
    )
    .map((p) => ({
      grade: grades.get(p.gradeId)?.name ?? "",
      subject: subjects.get(p.subjectId)?.code ?? "",
      units: live(rows.units)
        .filter((u) => u.programId === p.id)
        .sort((a, b) => a.position - b.position)
        .map((u) => ({
          name: u.name,
          description: u.description,
          notions: live(rows.notions)
            .filter((n) => n.unitId === u.id)
            .sort((a, b) => a.position - b.position)
            .map((n) => ({
              code: n.code,
              name: n.name,
              description: n.description,
              prerequisites: n.prerequisites.flatMap((id) => {
                const code = codeOf.get(id);
                return code ? [code] : [];
              }),
              misconceptions: live(n.misconceptions).map((m, i) => ({
                key: `idee-${i + 1}`,
                description: m.description,
              })),
            })),
        })),
    }));
}

/** Pays complet en YAML : country.yaml et ses programmes, réimportable tel quel. */
export function exportCurriculumYaml(rows: CurriculumRows): string {
  const doc: CountryDoc = {
    code: rows.country.code,
    name: rows.country.name,
    unitLabel: rows.country.unitLabel,
    grades: live(rows.grades)
      .sort((a, b) => a.position - b.position)
      .map((g) => g.name),
    programs: programDocs(rows),
  };
  return stringify(doc, { lineWidth: 0 });
}

const csvCell = (value: string) =>
  /[",;\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;

/** Notions du pays en CSV (séparateur virgule, en-tête en première ligne). */
export function exportNotionsCsv(rows: CurriculumRows): string {
  const lines: string[] = [NOTION_CSV_COLUMNS.join(",")];
  for (const p of programDocs(rows)) {
    for (const u of p.units) {
      for (const n of u.notions) {
        lines.push(
          [
            p.grade,
            p.subject,
            u.name,
            n.code,
            n.name,
            n.description,
            n.prerequisites.join(" | "),
            n.misconceptions.map((m) => m.description).join(" | "),
          ]
            .map(csvCell)
            .join(","),
        );
      }
    }
  }
  return `${lines.join("\n")}\n`;
}

// --- Lecture -------------------------------------------------------------------

/** Découpe un CSV (guillemets doublés, séparateur « , » ou « ; » deviné sur l'en-tête). */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const header = clean.split(/\r?\n/, 1)[0] ?? "";
  const sep =
    (header.match(/;/g)?.length ?? 0) > (header.match(/,/g)?.length ?? 0)
      ? ";"
      : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const list = (cell: string | undefined) =>
  (cell ?? "")
    .split("|")
    .map((s) => s.trim())
    .filter((s) => s !== "");

function csvToPrograms(text: string): Result<ProgramDoc[], ImportIssue[]> {
  const [header, ...body] = parseCsv(text);
  if (!header) return err([{ kind: "empty" }]);
  const index = new Map(header.map((h, i) => [h.trim().toLowerCase(), i]));
  const missing = NOTION_CSV_COLUMNS.filter(
    (c) => c !== "prerequis" && c !== "idees_fausses" && !index.has(c),
  );
  if (missing.length > 0)
    return err([
      {
        kind: "csv",
        line: 1,
        message: `colonnes manquantes : ${missing.join(", ")}`,
      },
    ]);
  const get = (r: string[], c: (typeof NOTION_CSV_COLUMNS)[number]) => {
    const i = index.get(c);
    return i === undefined ? "" : (r[i] ?? "").trim();
  };
  const issues: ImportIssue[] = [];
  const programs = new Map<string, ProgramDoc>();
  body.forEach((r, i) => {
    const line = i + 2;
    const grade = get(r, "classe");
    const subject = get(r, "matiere");
    const unitName = get(r, "unite");
    const code = get(r, "code");
    const name = get(r, "nom");
    const description = get(r, "description");
    if (!grade || !subject || !unitName || !code || !name || !description) {
      issues.push({
        kind: "csv",
        line,
        message:
          "classe, matiere, unite, code, nom et description sont obligatoires",
      });
      return;
    }
    const key = `${grade}\u0000${subject}`;
    const program = programs.get(key) ?? { grade, subject, units: [] };
    programs.set(key, program);
    let unit = program.units.find((u) => u.name === unitName);
    if (!unit) {
      unit = { name: unitName, description: "", notions: [] };
      program.units.push(unit);
    }
    unit.notions.push({
      code,
      name,
      description,
      prerequisites: list(get(r, "prerequis")),
      misconceptions: list(get(r, "idees_fausses")).map((d, k) => ({
        key: `idee-${k + 1}`,
        description: d,
      })),
    });
  });
  return issues.length > 0 ? err(issues) : ok([...programs.values()]);
}

/** Contenu d'un fichier importé : des programmes, et éventuellement le pays. */
export interface ParsedImport {
  country: Omit<CountryDoc, "programs"> | null;
  programs: ProgramDoc[];
}

export function parseCurriculumImport(
  format: ImportFormat,
  text: string,
): Result<ParsedImport, ImportIssue[]> {
  if (text.trim() === "") return err([{ kind: "empty" }]);
  if (format === "csv") {
    const programs = csvToPrograms(text);
    return programs.ok
      ? ok({ country: null, programs: programs.value })
      : programs;
  }
  let raw: unknown;
  try {
    raw = parse(text);
  } catch (e) {
    return err([
      {
        kind: "parse",
        file: "import",
        message: e instanceof Error ? e.message : String(e),
      },
    ]);
  }
  const isCountry = typeof raw === "object" && raw !== null && "grades" in raw;
  if (isCountry) {
    const parsed = countryDocSchema.safeParse(raw);
    if (!parsed.success)
      return err([
        {
          kind: "parse",
          file: "import",
          message: z.prettifyError(parsed.error),
        },
      ]);
    const { programs, ...country } = parsed.data;
    return ok({ country, programs });
  }
  const parsed = programSchema.safeParse(raw);
  if (!parsed.success)
    return err([
      { kind: "parse", file: "import", message: z.prettifyError(parsed.error) },
    ]);
  return ok({ country: null, programs: [parsed.data] });
}

// --- Plan d'import -------------------------------------------------------------

/** Ce que l'import va écrire, avec les identifiants des lignes à créer. */
export interface CurriculumChanges {
  grades: Grade[];
  programs: Program[];
  units: Unit[];
  /** Notions nouvelles (sans prérequis ni idées fausses : voir plus bas). */
  notions: Omit<Notion, "prerequisites" | "misconceptions">[];
  /** Notions existantes modifiées ; `verified` repasse à faux si le contenu change. */
  notionUpdates: {
    id: NotionId;
    unitId: Notion["unitId"];
    name: string;
    description: string;
    position: number;
    verified: boolean;
  }[];
  /** Prérequis remplacés (notions nouvelles ou dont la liste change). */
  prerequisites: { notionId: NotionId; prerequisites: NotionId[] }[];
  misconceptions: Misconception[];
}

/** Résumé lisible, pour l'aperçu avant application. */
export interface ImportSummary {
  grades: string[];
  programs: string[];
  units: string[];
  newNotions: string[];
  updatedNotions: { code: string; fields: string[] }[];
  prerequisites: { code: string; before: string[]; after: string[] }[];
  misconceptions: { code: string; description: string }[];
  /** Notions du pays absentes du fichier : elles sont conservées telles quelles. */
  untouched: number;
}

export interface ImportPlan {
  changes: CurriculumChanges;
  summary: ImportSummary;
  /** Vrai si l'import ne change rien. */
  empty: boolean;
}

/**
 * Compare le fichier au référentiel actuel du pays et prépare les écritures.
 * Le résultat (référentiel actuel + changements) est validé en entier par
 * `assembleCurriculum` : prérequis connus, pas de cycle, codes uniques.
 */
export function planCurriculumImport(
  current: CurriculumRows,
  incoming: ParsedImport,
  newId: () => string = randomUUID,
): Result<ImportPlan, ImportIssue[]> {
  const issues: ImportIssue[] = [];
  const countryId = current.country.id;
  if (incoming.country && incoming.country.code !== current.country.code) {
    return err([
      {
        kind: "country_mismatch",
        expected: current.country.code,
        found: incoming.country.code,
      },
    ]);
  }

  const changes: CurriculumChanges = {
    grades: [],
    programs: [],
    units: [],
    notions: [],
    notionUpdates: [],
    prerequisites: [],
    misconceptions: [],
  };
  const summary: ImportSummary = {
    grades: [],
    programs: [],
    units: [],
    newNotions: [],
    updatedNotions: [],
    prerequisites: [],
    misconceptions: [],
    untouched: 0,
  };

  const grades = [...current.grades];
  let nextPosition = Math.max(-1, ...grades.map((g) => g.position)) + 1;
  const gradeNamed = (name: string): Grade => {
    const found = grades.find((g) => g.name === name);
    if (found) return found;
    const g: Grade = {
      id: asGradeId(newId()),
      countryId,
      name,
      position: nextPosition++,
      archived: false,
    };
    grades.push(g);
    changes.grades.push(g);
    summary.grades.push(name);
    return g;
  };
  for (const name of incoming.country?.grades ?? []) gradeNamed(name);

  const programs = [...current.programs];
  const units = [...current.units];
  const notionsByCode = new Map(current.notions.map((n) => [n.code, n]));
  const codeOfId = new Map(current.notions.map((n) => [n.id, n.code]));
  /** Notions du fichier : leur id et les codes de leurs prérequis. */
  const fileNotions: {
    id: NotionId;
    code: string;
    prerequisites: string[];
    existing: Notion | undefined;
  }[] = [];
  const seenCodes = new Set<string>();
  const newMisconceptions = new Map<string, Misconception[]>();

  for (const p of incoming.programs) {
    const subject = current.subjects.find((s) => s.code === p.subject);
    if (!subject) {
      issues.push({ kind: "unknown_subject", subject: p.subject });
      continue;
    }
    const grade = gradeNamed(p.grade);
    let program = programs.find(
      (x) => x.gradeId === grade.id && x.subjectId === subject.id,
    );
    if (!program) {
      program = {
        id: asProgramId(newId()),
        countryId,
        gradeId: grade.id,
        subjectId: subject.id,
        archived: false,
      };
      programs.push(program);
      changes.programs.push(program);
      summary.programs.push(`${grade.name} · ${subject.name}`);
    }
    const programId = program.id;
    let unitPosition =
      Math.max(
        -1,
        ...units
          .filter((u) => u.programId === programId)
          .map((u) => u.position),
      ) + 1;
    for (const u of p.units) {
      let unit = units.find(
        (x) => x.programId === programId && x.name === u.name,
      );
      if (!unit) {
        unit = {
          id: asUnitId(newId()),
          programId,
          name: u.name,
          description: u.description,
          position: unitPosition++,
          archived: false,
        };
        units.push(unit);
        changes.units.push(unit);
        summary.units.push(`${grade.name} · ${subject.name} · ${u.name}`);
      }
      const unitId = unit.id;
      // Une notion garde sa place ; une notion nouvelle (ou qui change
      // d'unité) se range à la fin de son unité, dans l'ordre du fichier.
      let nextInUnit =
        Math.max(
          -1,
          ...current.notions
            .filter((x) => x.unitId === unitId)
            .map((x) => x.position),
        ) + 1;
      u.notions.forEach((n) => {
        if (seenCodes.has(n.code)) {
          issues.push({ kind: "duplicate_code_in_file", code: n.code });
          return;
        }
        seenCodes.add(n.code);
        const existing = notionsByCode.get(n.code);
        const id = existing?.id ?? asNotionId(newId());
        const position =
          existing && existing.unitId === unitId
            ? existing.position
            : nextInUnit++;
        if (!existing) {
          changes.notions.push({
            id,
            unitId,
            code: n.code,
            name: n.name,
            description: n.description,
            position,
            verified: false,
            archived: false,
          });
          summary.newNotions.push(n.code);
          codeOfId.set(id, n.code);
        } else {
          const fields = [
            existing.name !== n.name && "name",
            existing.description !== n.description && "description",
            existing.unitId !== unitId && "unit",
          ].filter((f): f is string => typeof f === "string");
          if (fields.length > 0) {
            const contentChanged =
              fields.includes("name") || fields.includes("description");
            changes.notionUpdates.push({
              id,
              unitId,
              name: n.name,
              description: n.description,
              position,
              verified: contentChanged ? false : existing.verified,
            });
            summary.updatedNotions.push({ code: n.code, fields });
          }
        }
        const known = new Set(
          (existing?.misconceptions ?? []).map((m) => m.description.trim()),
        );
        const added: Misconception[] = [];
        for (const m of n.misconceptions) {
          const d = m.description.trim();
          if (known.has(d)) continue;
          known.add(d);
          const mis: Misconception = {
            id: asMisconceptionId(newId()),
            notionId: id,
            description: d,
            archived: false,
          };
          added.push(mis);
          changes.misconceptions.push(mis);
          summary.misconceptions.push({ code: n.code, description: d });
        }
        newMisconceptions.set(id, added);
        fileNotions.push({
          id,
          code: n.code,
          prerequisites: n.prerequisites,
          existing,
        });
      });
    }
  }

  // Prérequis : résolus par code parmi les notions du pays et du fichier.
  const idOfCode = new Map<string, NotionId>([
    ...current.notions.map((n): [string, NotionId] => [n.code, n.id]),
    ...fileNotions.map((n): [string, NotionId] => [n.code, n.id]),
  ]);
  const prereqsOf = new Map<string, readonly NotionId[]>(
    current.notions.map((n) => [n.id, n.prerequisites]),
  );
  for (const n of fileNotions) {
    const ids: NotionId[] = [];
    for (const code of n.prerequisites) {
      const id = idOfCode.get(code);
      if (!id) {
        issues.push({
          kind: "unknown_prerequisite",
          notionId: n.code,
          prerequisiteId: code,
        });
      } else if (!ids.includes(id)) ids.push(id);
    }
    const before = n.existing?.prerequisites ?? [];
    const same =
      before.length === ids.length && before.every((p) => ids.includes(p));
    if (!same || !n.existing) {
      prereqsOf.set(n.id, ids);
      if (ids.length > 0 || before.length > 0) {
        changes.prerequisites.push({ notionId: n.id, prerequisites: ids });
        summary.prerequisites.push({
          code: n.code,
          before: before.map((p) => codeOfId.get(p) ?? p),
          after: ids.map((p) => codeOfId.get(p) ?? p),
        });
      }
    }
  }
  if (issues.length > 0) return err(issues);

  const updated = new Map(changes.notionUpdates.map((u) => [u.id, u]));
  const after: CurriculumRows = {
    country: current.country,
    subjects: current.subjects,
    grades,
    programs,
    units,
    notions: [
      ...current.notions.map((n) => ({
        ...n,
        ...(updated.get(n.id) ?? {}),
        prerequisites: prereqsOf.get(n.id) ?? n.prerequisites,
        misconceptions: [
          ...n.misconceptions,
          ...(newMisconceptions.get(n.id) ?? []),
        ],
      })),
      ...changes.notions.map((n) => ({
        ...n,
        prerequisites: prereqsOf.get(n.id) ?? [],
        misconceptions: newMisconceptions.get(n.id) ?? [],
      })),
    ],
  };
  const assembled = assembleCurriculum(after);
  if (!assembled.ok) {
    // Des codes plutôt que des identifiants, pour que l'erreur soit lisible.
    const code = (id: string) => codeOfId.get(asNotionId(id)) ?? id;
    return err(
      assembled.error.map((e) =>
        e.kind === "prerequisite_cycle"
          ? { ...e, cycle: e.cycle.map((id) => asNotionId(code(id))) }
          : e,
      ),
    );
  }

  summary.untouched = live(current.notions).filter(
    (n) => !seenCodes.has(n.code),
  ).length;
  const empty =
    changes.grades.length +
      changes.programs.length +
      changes.units.length +
      changes.notions.length +
      changes.notionUpdates.length +
      changes.prerequisites.length +
      changes.misconceptions.length ===
    0;
  return ok({ changes, summary, empty });
}
