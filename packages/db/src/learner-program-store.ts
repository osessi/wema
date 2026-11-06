import type {
  CountryId,
  GradeId,
  LearnerId,
  OrganizationId,
  ProgramId,
  SubjectId,
  UserId,
} from "@wema/domain";
import {
  asCountryId,
  asGradeId,
  asLearnerId,
  asOrganizationId,
  asProgramId,
  asSubjectId,
} from "@wema/domain";
import type { SqlExecutor } from "./executor";

/** Programme du référentiel, avec ce qu'il faut pour le choisir et l'afficher. */
export interface ProgramEntry {
  programId: ProgramId;
  countryId: CountryId;
  countryName: string;
  gradeId: GradeId;
  gradeName: string;
  gradePosition: number;
  subjectId: SubjectId;
  subjectName: string;
}

/** Programme suivi par un élève : par une classe, ou choisi par son parent. */
export interface LearnerProgram extends ProgramEntry {
  source: "class" | "individual";
  /** Classe (source « class ») ; `null` pour un programme individuel. */
  classId: string | null;
  className: string | null;
  /** Famille où le programme individuel a été choisi. */
  organizationId: OrganizationId;
}

interface EntryRow {
  program_id: string;
  country_id: string;
  country_name: string;
  grade_id: string;
  grade_name: string;
  grade_position: number;
  subject_id: string;
  subject_name: string;
}

const ENTRY_COLUMNS = `p.id AS program_id, c.id AS country_id, c.name AS country_name,
  g.id AS grade_id, g.name AS grade_name, g.position AS grade_position,
  s.id AS subject_id, s.name AS subject_name`;
const ENTRY_JOINS = `JOIN countries c ON c.id = p.country_id JOIN grades g ON g.id = p.grade_id
  JOIN subjects s ON s.id = p.subject_id`;
const ACTIVE =
  "p.archived_at IS NULL AND c.archived_at IS NULL AND g.archived_at IS NULL AND s.archived_at IS NULL";

const toEntry = (r: EntryRow): ProgramEntry => ({
  programId: asProgramId(r.program_id),
  countryId: asCountryId(r.country_id),
  countryName: r.country_name,
  gradeId: asGradeId(r.grade_id),
  gradeName: r.grade_name,
  gradePosition: r.grade_position,
  subjectId: asSubjectId(r.subject_id),
  subjectName: r.subject_name,
});

export type SetProgramsError =
  | { kind: "program_not_found" }
  /** Deux programmes de la même matière, ou de pays différents. */
  | { kind: "programs_conflict" };

/**
 * Programmes des élèves : ceux de leurs classes et ceux que leur parent a
 * choisis (programme individuel, migration 0027). Le choix entre les deux
 * (la classe d'abord) revient au cœur (`effectivePrograms`).
 */
export function createLearnerProgramStore(db: SqlExecutor) {
  return {
    /** Programmes ouverts du référentiel, pour les choisir (pays, classe, matière). */
    async catalog(): Promise<ProgramEntry[]> {
      const { rows } = await db.query<EntryRow>(
        `SELECT ${ENTRY_COLUMNS} FROM programs p ${ENTRY_JOINS} WHERE ${ACTIVE}
         ORDER BY c.name, g.position, s.name`,
      );
      return rows.map(toEntry);
    },

    /**
     * Tous les programmes d'un élève : ceux de ses classes (actives, dont il
     * est encore membre de l'organisation) puis ses programmes individuels.
     */
    async programsOf(learnerId: LearnerId): Promise<LearnerProgram[]> {
      const { rows } = await db.query<
        EntryRow & {
          source: "class" | "individual";
          class_id: string | null;
          class_name: string | null;
          organization_id: string;
        }
      >(
        `SELECT ${ENTRY_COLUMNS}, 'class' AS source, k.id AS class_id, k.name AS class_name,
           k.organization_id
         FROM class_members m JOIN classes k ON k.id = m.class_id
         JOIN programs p ON p.id = k.program_id ${ENTRY_JOINS}
         WHERE m.user_id = $1 AND m.role = 'learner' AND k.archived_at IS NULL
           AND EXISTS (SELECT 1 FROM memberships o WHERE o.organization_id = k.organization_id AND o.user_id = m.user_id)
         UNION ALL
         SELECT ${ENTRY_COLUMNS}, 'individual', NULL, NULL, lp.organization_id
         FROM learner_programs lp JOIN programs p ON p.id = lp.program_id ${ENTRY_JOINS}
         WHERE lp.learner_id = $1 AND p.archived_at IS NULL
           AND EXISTS (SELECT 1 FROM memberships o WHERE o.organization_id = lp.organization_id AND o.user_id = lp.learner_id)
         ORDER BY source, class_name, subject_name`,
        [learnerId],
      );
      return rows.map((r) => ({
        ...toEntry(r),
        source: r.source,
        classId: r.class_id,
        className: r.class_name,
        organizationId: asOrganizationId(r.organization_id),
      }));
    },

    /** Élèves d'une organisation qui y ont un programme individuel. */
    async learnersWithPrograms(
      organizationId: OrganizationId,
    ): Promise<{ learnerId: LearnerId; programId: ProgramId }[]> {
      const { rows } = await db.query<{
        learner_id: string;
        program_id: string;
      }>(
        `SELECT lp.learner_id, lp.program_id FROM learner_programs lp
         JOIN programs p ON p.id = lp.program_id
         WHERE lp.organization_id = $1 AND p.archived_at IS NULL
           AND EXISTS (SELECT 1 FROM memberships o WHERE o.organization_id = lp.organization_id AND o.user_id = lp.learner_id)
         ORDER BY lp.created_at`,
        [organizationId],
      );
      return rows.map((r) => ({
        learnerId: asLearnerId(r.learner_id),
        programId: asProgramId(r.program_id),
      }));
    },

    /** Organisations qui ont au moins un programme individuel. */
    async organizationsWithPrograms(): Promise<OrganizationId[]> {
      const { rows } = await db.query<{ organization_id: string }>(
        "SELECT DISTINCT organization_id FROM learner_programs",
      );
      return rows.map((r) => asOrganizationId(r.organization_id));
    },

    /**
     * Remplace les programmes individuels d'un élève dans une famille. Les
     * programmes doivent exister, être ouverts, d'un seul pays et d'une
     * matière chacun.
     */
    async setPrograms(input: {
      learnerId: LearnerId;
      organizationId: OrganizationId;
      programIds: readonly ProgramId[];
      chosenBy: UserId;
    }): Promise<
      | { ok: true; programs: ProgramEntry[] }
      | { ok: false; error: SetProgramsError }
    > {
      const ids = [...new Set(input.programIds)];
      const { rows } = await db.query<EntryRow>(
        `SELECT ${ENTRY_COLUMNS} FROM programs p ${ENTRY_JOINS}
         WHERE p.id = ANY($1::uuid[]) AND ${ACTIVE}`,
        [ids],
      );
      if (rows.length !== ids.length)
        return { ok: false, error: { kind: "program_not_found" } };
      const entries = rows.map(toEntry);
      if (
        new Set(entries.map((e) => e.subjectId)).size !== entries.length ||
        new Set(entries.map((e) => e.countryId)).size > 1
      )
        return { ok: false, error: { kind: "programs_conflict" } };
      await db.transaction(async (tx) => {
        await tx.query(
          "DELETE FROM learner_programs WHERE learner_id = $1 AND organization_id = $2",
          [input.learnerId, input.organizationId],
        );
        for (const e of entries)
          await tx.query(
            `INSERT INTO learner_programs (learner_id, program_id, subject_id, organization_id, chosen_by)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (learner_id, subject_id) DO UPDATE
               SET program_id = EXCLUDED.program_id, organization_id = EXCLUDED.organization_id,
                   chosen_by = EXCLUDED.chosen_by, created_at = now()`,
            [
              input.learnerId,
              e.programId,
              e.subjectId,
              input.organizationId,
              input.chosenBy,
            ],
          );
      });
      return { ok: true, programs: entries };
    },
  };
}

export type LearnerProgramStore = ReturnType<typeof createLearnerProgramStore>;
