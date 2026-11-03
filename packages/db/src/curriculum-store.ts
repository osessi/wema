import { randomUUID } from "node:crypto";
import type {
  Country,
  CountryId,
  Grade,
  GradeId,
  Misconception,
  MisconceptionId,
  Notion,
  NotionId,
  Program,
  ProgramId,
  Result,
  Subject,
  SubjectId,
  Unit,
  UnitId,
} from "@wema/domain";
import {
  asCountryCode,
  asCountryId,
  asGradeId,
  asMisconceptionId,
  asNotionId,
  asProgramId,
  asSubjectId,
  asUnitId,
  err,
  ok,
} from "@wema/domain";
import type { SqlExecutor } from "./executor";

/** Référentiel complet d'un pays (même forme que `CurriculumRows` de @wema/curriculum). */
export interface CountryCurriculum {
  country: Country;
  subjects: readonly Subject[];
  grades: readonly Grade[];
  programs: readonly Program[];
  units: readonly Unit[];
  notions: readonly Notion[];
}

export type CurriculumWriteError =
  | { kind: "not_found" }
  /** Code ou nom déjà pris (pays, matière, classe, programme, notion). */
  | { kind: "duplicate"; constraint: string }
  /** Référence vers une ligne inconnue ou d'un autre pays. */
  | { kind: "invalid_reference"; constraint: string };

function pgError(e: unknown): { code: string; constraint: string } | null {
  if (
    typeof e !== "object" ||
    e === null ||
    !("code" in e) ||
    typeof e.code !== "string"
  )
    return null;
  const constraint =
    "constraint" in e && typeof e.constraint === "string" ? e.constraint : "";
  return { code: e.code, constraint };
}

/** Convertit les violations de contraintes attendues en erreurs typées. */
async function write<T>(
  fn: () => Promise<T | null>,
): Promise<Result<T, CurriculumWriteError>> {
  try {
    const value = await fn();
    return value === null ? err({ kind: "not_found" }) : ok(value);
  } catch (e) {
    const pg = pgError(e);
    if (pg?.code === "23505")
      return err({ kind: "duplicate", constraint: pg.constraint });
    if (pg?.code === "23503")
      return err({ kind: "invalid_reference", constraint: pg.constraint });
    throw e;
  }
}

const archivedAt = (archived: boolean | undefined) =>
  archived === undefined ? null : archived ? "archive" : "restore";

// Colonne archived_at : on garde la date du premier archivage.
const ARCHIVE_SQL = (param: string) =>
  `archived_at = CASE ${param}::text WHEN 'archive' THEN coalesce(archived_at, now()) WHEN 'restore' THEN NULL ELSE archived_at END`;

interface CountryRow {
  id: string;
  code: string;
  name: string;
  unit_label_singular: string;
  unit_label_plural: string;
  archived_at: Date | null;
}
const COUNTRY_COLUMNS =
  "id, code, name, unit_label_singular, unit_label_plural, archived_at";
const toCountry = (r: CountryRow): Country => ({
  id: asCountryId(r.id),
  code: asCountryCode(r.code),
  name: r.name,
  unitLabel: { singular: r.unit_label_singular, plural: r.unit_label_plural },
  archived: r.archived_at !== null,
});

interface SubjectRow {
  id: string;
  code: string;
  name: string;
  archived_at: Date | null;
}
const toSubject = (r: SubjectRow): Subject => ({
  id: asSubjectId(r.id),
  code: r.code,
  name: r.name,
  archived: r.archived_at !== null,
});

interface GradeRow {
  id: string;
  country_id: string;
  name: string;
  position: number;
  archived_at: Date | null;
}
const toGrade = (r: GradeRow): Grade => ({
  id: asGradeId(r.id),
  countryId: asCountryId(r.country_id),
  name: r.name,
  position: r.position,
  archived: r.archived_at !== null,
});

interface ProgramRow {
  id: string;
  country_id: string;
  grade_id: string;
  subject_id: string;
  archived_at: Date | null;
}
const toProgram = (r: ProgramRow): Program => ({
  id: asProgramId(r.id),
  countryId: asCountryId(r.country_id),
  gradeId: asGradeId(r.grade_id),
  subjectId: asSubjectId(r.subject_id),
  archived: r.archived_at !== null,
});

interface UnitRow {
  id: string;
  program_id: string;
  name: string;
  description: string;
  position: number;
  archived_at: Date | null;
}
const toUnit = (r: UnitRow): Unit => ({
  id: asUnitId(r.id),
  programId: asProgramId(r.program_id),
  name: r.name,
  description: r.description,
  position: r.position,
  archived: r.archived_at !== null,
});

interface NotionRow {
  id: string;
  unit_id: string;
  code: string;
  name: string;
  description: string;
  position: number;
  verified: boolean;
  archived_at: Date | null;
}
interface MisconceptionRow {
  id: string;
  notion_id: string;
  description: string;
  archived_at: Date | null;
}
const toMisconception = (r: MisconceptionRow): Misconception => ({
  id: asMisconceptionId(r.id),
  notionId: asNotionId(r.notion_id),
  description: r.description,
  archived: r.archived_at !== null,
});

export function createCurriculumStore(db: SqlExecutor) {
  const getCountry = async (id: CountryId): Promise<Country | null> => {
    const { rows } = await db.query<CountryRow>(
      `SELECT ${COUNTRY_COLUMNS} FROM countries WHERE id = $1`,
      [id],
    );
    return rows[0] ? toCountry(rows[0]) : null;
  };
  const listSubjects = async (): Promise<Subject[]> => {
    const { rows } = await db.query<SubjectRow>(
      "SELECT id, code, name, archived_at FROM subjects ORDER BY name",
    );
    return rows.map(toSubject);
  };

  return {
    async listCountries(): Promise<Country[]> {
      const { rows } = await db.query<CountryRow>(
        `SELECT ${COUNTRY_COLUMNS} FROM countries ORDER BY name`,
      );
      return rows.map(toCountry);
    },

    getCountry,

    createCountry: (input: {
      code: string;
      name: string;
      unitLabel: Country["unitLabel"];
    }) =>
      write(async () => {
        const { rows } = await db.query<CountryRow>(
          `INSERT INTO countries (id, code, name, unit_label_singular, unit_label_plural)
           VALUES ($1, $2, $3, $4, $5) RETURNING ${COUNTRY_COLUMNS}`,
          [
            randomUUID(),
            asCountryCode(input.code),
            input.name,
            input.unitLabel.singular,
            input.unitLabel.plural,
          ],
        );
        return rows[0] ? toCountry(rows[0]) : null;
      }),

    updateCountry: (
      id: CountryId,
      input: {
        name: string;
        unitLabel: Country["unitLabel"];
        archived?: boolean | undefined;
      },
    ) =>
      write(async () => {
        const { rows } = await db.query<CountryRow>(
          `UPDATE countries SET name = $2, unit_label_singular = $3, unit_label_plural = $4, ${ARCHIVE_SQL("$5")}
           WHERE id = $1 RETURNING ${COUNTRY_COLUMNS}`,
          [
            id,
            input.name,
            input.unitLabel.singular,
            input.unitLabel.plural,
            archivedAt(input.archived),
          ],
        );
        return rows[0] ? toCountry(rows[0]) : null;
      }),

    listSubjects,

    createSubject: (input: { code: string; name: string }) =>
      write(async () => {
        const { rows } = await db.query<SubjectRow>(
          "INSERT INTO subjects (id, code, name) VALUES ($1, $2, $3) RETURNING id, code, name, archived_at",
          [randomUUID(), input.code, input.name],
        );
        return rows[0] ? toSubject(rows[0]) : null;
      }),

    updateSubject: (
      id: SubjectId,
      input: { name: string; archived?: boolean | undefined },
    ) =>
      write(async () => {
        const { rows } = await db.query<SubjectRow>(
          `UPDATE subjects SET name = $2, ${ARCHIVE_SQL("$3")} WHERE id = $1 RETURNING id, code, name, archived_at`,
          [id, input.name, archivedAt(input.archived)],
        );
        return rows[0] ? toSubject(rows[0]) : null;
      }),

    createGrade: (input: {
      countryId: CountryId;
      name: string;
      position: number;
    }) =>
      write(async () => {
        const { rows } = await db.query<GradeRow>(
          `INSERT INTO grades (id, country_id, name, position) VALUES ($1, $2, $3, $4)
           RETURNING id, country_id, name, position, archived_at`,
          [randomUUID(), input.countryId, input.name, input.position],
        );
        return rows[0] ? toGrade(rows[0]) : null;
      }),

    updateGrade: (
      id: GradeId,
      input: { name: string; position: number; archived?: boolean | undefined },
    ) =>
      write(async () => {
        const { rows } = await db.query<GradeRow>(
          `UPDATE grades SET name = $2, position = $3, ${ARCHIVE_SQL("$4")} WHERE id = $1
           RETURNING id, country_id, name, position, archived_at`,
          [id, input.name, input.position, archivedAt(input.archived)],
        );
        return rows[0] ? toGrade(rows[0]) : null;
      }),

    /** Le pays du programme est celui de la classe. */
    createProgram: (input: { gradeId: GradeId; subjectId: SubjectId }) =>
      write(async () => {
        const { rows } = await db.query<ProgramRow>(
          `INSERT INTO programs (id, country_id, grade_id, subject_id)
           SELECT $1, g.country_id, g.id, $3 FROM grades g WHERE g.id = $2
           RETURNING id, country_id, grade_id, subject_id, archived_at`,
          [randomUUID(), input.gradeId, input.subjectId],
        );
        return rows[0] ? toProgram(rows[0]) : null;
      }),

    archiveProgram: (id: ProgramId, archived: boolean) =>
      write(async () => {
        const { rows } = await db.query<ProgramRow>(
          `UPDATE programs SET ${ARCHIVE_SQL("$2")} WHERE id = $1
           RETURNING id, country_id, grade_id, subject_id, archived_at`,
          [id, archivedAt(archived)],
        );
        return rows[0] ? toProgram(rows[0]) : null;
      }),

    createUnit: (input: {
      programId: ProgramId;
      name: string;
      description: string;
      position: number;
    }) =>
      write(async () => {
        const { rows } = await db.query<UnitRow>(
          `INSERT INTO units (id, country_id, program_id, name, description, position)
           SELECT $1, p.country_id, p.id, $3, $4, $5 FROM programs p WHERE p.id = $2
           RETURNING id, program_id, name, description, position, archived_at`,
          [
            randomUUID(),
            input.programId,
            input.name,
            input.description,
            input.position,
          ],
        );
        return rows[0] ? toUnit(rows[0]) : null;
      }),

    updateUnit: (
      id: UnitId,
      input: {
        name: string;
        description: string;
        position: number;
        archived?: boolean | undefined;
      },
    ) =>
      write(async () => {
        const { rows } = await db.query<UnitRow>(
          `UPDATE units SET name = $2, description = $3, position = $4, ${ARCHIVE_SQL("$5")} WHERE id = $1
           RETURNING id, program_id, name, description, position, archived_at`,
          [
            id,
            input.name,
            input.description,
            input.position,
            archivedAt(input.archived),
          ],
        );
        return rows[0] ? toUnit(rows[0]) : null;
      }),

    /** Pays de la notion, pour valider un changement de prérequis. */
    async countryOfNotion(id: NotionId): Promise<CountryId | null> {
      const { rows } = await db.query<{ country_id: string }>(
        "SELECT country_id FROM notions WHERE id = $1",
        [id],
      );
      return rows[0] ? asCountryId(rows[0].country_id) : null;
    },

    async countryOfProgram(id: ProgramId): Promise<CountryId | null> {
      const { rows } = await db.query<{ country_id: string }>(
        "SELECT country_id FROM programs WHERE id = $1",
        [id],
      );
      return rows[0] ? asCountryId(rows[0].country_id) : null;
    },

    createNotion: (input: {
      unitId: UnitId;
      code: string;
      name: string;
      description: string;
      position: number;
    }) =>
      write(async () => {
        const { rows } = await db.query<{ id: string }>(
          `INSERT INTO notions (id, country_id, unit_id, code, name, description, position)
           SELECT $1, u.country_id, u.id, $3, $4, $5, $6 FROM units u WHERE u.id = $2
           RETURNING id`,
          [
            randomUUID(),
            input.unitId,
            input.code,
            input.name,
            input.description,
            input.position,
          ],
        );
        return rows[0] ? asNotionId(rows[0].id) : null;
      }),

    /** Une notion peut changer d'unité, mais seulement dans son pays (clé étrangère). */
    updateNotion: (
      id: NotionId,
      input: {
        unitId: UnitId;
        code: string;
        name: string;
        description: string;
        position: number;
        verified: boolean;
        archived?: boolean | undefined;
      },
    ) =>
      write(async () => {
        const { rows } = await db.query<{ id: string }>(
          `UPDATE notions SET unit_id = $2, code = $3, name = $4, description = $5, position = $6,
             verified = $7, ${ARCHIVE_SQL("$8")}
           WHERE id = $1 RETURNING id`,
          [
            id,
            input.unitId,
            input.code,
            input.name,
            input.description,
            input.position,
            input.verified,
            archivedAt(input.archived),
          ],
        );
        return rows[0] ? asNotionId(rows[0].id) : null;
      }),

    /**
     * Remplace les prérequis d'une notion. L'absence de cycle est vérifiée
     * avant, par `checkPrerequisiteChange` de @wema/curriculum.
     */
    setPrerequisites: (id: NotionId, prerequisites: readonly NotionId[]) =>
      write(() =>
        db.transaction(async (tx) => {
          const { rows } = await tx.query<{ country_id: string }>(
            "SELECT country_id FROM notions WHERE id = $1",
            [id],
          );
          const country = rows[0]?.country_id;
          if (!country) return null;
          await tx.query(
            "DELETE FROM notion_prerequisites WHERE notion_id = $1",
            [id],
          );
          for (const p of new Set(prerequisites)) {
            await tx.query(
              "INSERT INTO notion_prerequisites (notion_id, prerequisite_id, country_id) VALUES ($1, $2, $3)",
              [id, p, country],
            );
          }
          return id;
        }),
      ),

    createMisconception: (input: { notionId: NotionId; description: string }) =>
      write(async () => {
        const { rows } = await db.query<MisconceptionRow>(
          `INSERT INTO misconceptions (id, notion_id, description) VALUES ($1, $2, $3)
           RETURNING id, notion_id, description, archived_at`,
          [randomUUID(), input.notionId, input.description],
        );
        return rows[0] ? toMisconception(rows[0]) : null;
      }),

    updateMisconception: (
      id: MisconceptionId,
      input: { description: string; archived?: boolean | undefined },
    ) =>
      write(async () => {
        const { rows } = await db.query<MisconceptionRow>(
          `UPDATE misconceptions SET description = $2, ${ARCHIVE_SQL("$3")} WHERE id = $1
           RETURNING id, notion_id, description, archived_at`,
          [id, input.description, archivedAt(input.archived)],
        );
        return rows[0] ? toMisconception(rows[0]) : null;
      }),

    /** Référentiel complet d'un pays, archives comprises. */
    async loadCountry(id: CountryId): Promise<CountryCurriculum | null> {
      const country = await getCountry(id);
      if (!country) return null;
      const [
        subjects,
        grades,
        programs,
        units,
        notions,
        prerequisites,
        misconceptions,
      ] = await Promise.all([
        listSubjects(),
        db.query<GradeRow>(
          "SELECT id, country_id, name, position, archived_at FROM grades WHERE country_id = $1 ORDER BY position, name",
          [id],
        ),
        db.query<ProgramRow>(
          "SELECT id, country_id, grade_id, subject_id, archived_at FROM programs WHERE country_id = $1",
          [id],
        ),
        db.query<UnitRow>(
          `SELECT id, program_id, name, description, position, archived_at FROM units
           WHERE country_id = $1 ORDER BY position, name`,
          [id],
        ),
        db.query<NotionRow>(
          `SELECT id, unit_id, code, name, description, position, verified, archived_at FROM notions
           WHERE country_id = $1 ORDER BY position, name`,
          [id],
        ),
        db.query<{ notion_id: string; prerequisite_id: string }>(
          "SELECT notion_id, prerequisite_id FROM notion_prerequisites WHERE country_id = $1 ORDER BY prerequisite_id",
          [id],
        ),
        db.query<MisconceptionRow>(
          `SELECT m.id, m.notion_id, m.description, m.archived_at FROM misconceptions m
           JOIN notions n ON n.id = m.notion_id WHERE n.country_id = $1 ORDER BY m.created_at, m.id`,
          [id],
        ),
      ]);
      const prereqsOf = new Map<string, NotionId[]>();
      for (const p of prerequisites.rows) {
        prereqsOf.set(p.notion_id, [
          ...(prereqsOf.get(p.notion_id) ?? []),
          asNotionId(p.prerequisite_id),
        ]);
      }
      const misconceptionsOf = new Map<string, Misconception[]>();
      for (const m of misconceptions.rows) {
        misconceptionsOf.set(m.notion_id, [
          ...(misconceptionsOf.get(m.notion_id) ?? []),
          toMisconception(m),
        ]);
      }
      return {
        country,
        subjects,
        grades: grades.rows.map(toGrade),
        programs: programs.rows.map(toProgram),
        units: units.rows.map(toUnit),
        notions: notions.rows.map((r) => ({
          id: asNotionId(r.id),
          unitId: asUnitId(r.unit_id),
          code: r.code,
          name: r.name,
          description: r.description,
          position: r.position,
          prerequisites: prereqsOf.get(r.id) ?? [],
          misconceptions: misconceptionsOf.get(r.id) ?? [],
          verified: r.verified,
          archived: r.archived_at !== null,
        })),
      };
    },

    /**
     * Importe un référentiel (jeu d'exemple). Idempotent : une ligne dont
     * l'identifiant existe déjà n'est pas modifiée.
     */
    async importCountry(rows: CountryCurriculum): Promise<void> {
      await db.transaction(async (tx) => {
        const c = rows.country;
        await tx.query(
          `INSERT INTO countries (id, code, name, unit_label_singular, unit_label_plural)
           VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
          [c.id, c.code, c.name, c.unitLabel.singular, c.unitLabel.plural],
        );
        for (const s of rows.subjects) {
          await tx.query(
            "INSERT INTO subjects (id, code, name) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
            [s.id, s.code, s.name],
          );
        }
        for (const g of rows.grades) {
          await tx.query(
            "INSERT INTO grades (id, country_id, name, position) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING",
            [g.id, c.id, g.name, g.position],
          );
        }
        for (const p of rows.programs) {
          await tx.query(
            "INSERT INTO programs (id, country_id, grade_id, subject_id) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING",
            [p.id, c.id, p.gradeId, p.subjectId],
          );
        }
        for (const u of rows.units) {
          await tx.query(
            `INSERT INTO units (id, country_id, program_id, name, description, position)
             VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`,
            [u.id, c.id, u.programId, u.name, u.description, u.position],
          );
        }
        for (const n of rows.notions) {
          await tx.query(
            `INSERT INTO notions (id, country_id, unit_id, code, name, description, position, verified)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT DO NOTHING`,
            [
              n.id,
              c.id,
              n.unitId,
              n.code,
              n.name,
              n.description,
              n.position,
              n.verified,
            ],
          );
          for (const m of n.misconceptions) {
            await tx.query(
              "INSERT INTO misconceptions (id, notion_id, description) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
              [m.id, n.id, m.description],
            );
          }
        }
        for (const n of rows.notions) {
          for (const p of n.prerequisites) {
            await tx.query(
              `INSERT INTO notion_prerequisites (notion_id, prerequisite_id, country_id)
               VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
              [n.id, p, c.id],
            );
          }
        }
      });
    },
  };
}

export type CurriculumStore = ReturnType<typeof createCurriculumStore>;
