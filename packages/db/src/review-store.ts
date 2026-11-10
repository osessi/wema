import type { CountryId, OrganizationId } from "@wema/domain";
import type { SqlExecutor } from "./executor";

// Écran « À valider » du back-office : notions du référentiel pas encore
// vérifiées et exercices de la bibliothèque Wema encore en brouillon, tous
// pays confondus. Les compteurs sont comptés par la base (pas de plafond).

export interface PendingNotion {
  id: string;
  code: string;
  name: string;
  description: string;
  position: number;
  unitId: string;
  unitName: string;
  countryId: string;
  countryName: string;
  subjectName: string;
  /** Clé d'icône de la matière (`SubjectIcon`). */
  subjectIcon: string | null;
  gradeName: string;
  createdAt: Date;
}

export interface PendingExercise {
  id: string;
  objective: string;
  statement: string;
  source: string;
  notionId: string;
  notionName: string;
  countryId: string;
  countryName: string;
  subjectName: string;
  /** Clé d'icône de la matière (`SubjectIcon`). */
  subjectIcon: string | null;
  createdAt: Date;
}

export interface AdminCounts {
  /** Notions non vérifiées + exercices de la bibliothèque en brouillon. */
  toReview: number;
  notions: number;
  exercises: number;
  /** Demandes de contact non traitées. */
  contacts: number;
}

/** Plafond d'affichage d'une liste (le compteur, lui, est exact). */
const LIST_LIMIT = 200;

const NOTION_PENDING = "NOT n.verified AND n.archived_at IS NULL";
const EXERCISE_PENDING =
  "e.status = 'draft' AND e.organization_id = $1 AND n.archived_at IS NULL";

export function createReviewStore(db: SqlExecutor) {
  return {
    async pendingNotions(
      filter: { countryId?: CountryId } = {},
    ): Promise<PendingNotion[]> {
      const { rows } = await db.query<{
        id: string;
        code: string;
        name: string;
        description: string;
        position: number;
        unit_id: string;
        unit_name: string;
        country_id: string;
        country_name: string;
        subject_name: string;
        subject_icon: string | null;
        grade_name: string;
        created_at: Date;
      }>(
        `SELECT n.id, n.code, n.name, n.description, n.position, n.unit_id, u.name AS unit_name,
           n.country_id, c.name AS country_name, s.name AS subject_name, s.icon AS subject_icon, g.name AS grade_name, n.created_at
         FROM notions n JOIN units u ON u.id = n.unit_id JOIN programs p ON p.id = u.program_id
         JOIN subjects s ON s.id = p.subject_id JOIN grades g ON g.id = p.grade_id
         JOIN countries c ON c.id = n.country_id
         WHERE ${NOTION_PENDING} AND ($1::uuid IS NULL OR n.country_id = $1)
         ORDER BY c.name, s.name, g.position, u.position, n.position LIMIT ${LIST_LIMIT}`,
        [filter.countryId ?? null],
      );
      return rows.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        description: r.description,
        position: r.position,
        unitId: r.unit_id,
        unitName: r.unit_name,
        countryId: r.country_id,
        countryName: r.country_name,
        subjectName: r.subject_name,
        subjectIcon: r.subject_icon,
        gradeName: r.grade_name,
        createdAt: r.created_at,
      }));
    },

    async pendingExercises(
      library: OrganizationId,
      filter: { countryId?: CountryId } = {},
    ): Promise<PendingExercise[]> {
      const { rows } = await db.query<{
        id: string;
        objective: string;
        statement: string;
        source: string;
        notion_id: string;
        notion_name: string;
        country_id: string;
        country_name: string;
        subject_name: string;
        subject_icon: string | null;
        created_at: Date;
      }>(
        `SELECT e.id, e.objective, e.statement, e.source, n.id AS notion_id, n.name AS notion_name,
           n.country_id, c.name AS country_name, s.name AS subject_name, s.icon AS subject_icon, e.created_at
         FROM exercise_intents e JOIN notions n ON n.id = e.notion_id
         JOIN units u ON u.id = n.unit_id JOIN programs p ON p.id = u.program_id
         JOIN subjects s ON s.id = p.subject_id JOIN countries c ON c.id = n.country_id
         WHERE ${EXERCISE_PENDING} AND ($2::uuid IS NULL OR n.country_id = $2)
         ORDER BY e.created_at DESC LIMIT ${LIST_LIMIT}`,
        [library, filter.countryId ?? null],
      );
      return rows.map((r) => ({
        id: r.id,
        objective: r.objective,
        statement: r.statement,
        source: r.source,
        notionId: r.notion_id,
        notionName: r.notion_name,
        countryId: r.country_id,
        countryName: r.country_name,
        subjectName: r.subject_name,
        subjectIcon: r.subject_icon,
        createdAt: r.created_at,
      }));
    },

    /** Compteurs exacts ; `countryId` limite les notions et exercices à un pays. */
    async counts(
      library: OrganizationId | null,
      filter: { countryId?: CountryId } = {},
    ): Promise<AdminCounts> {
      const { rows } = await db.query<{
        notions: number;
        exercises: number;
        contacts: number;
      }>(
        `SELECT
           (SELECT count(*)::int FROM notions n WHERE ${NOTION_PENDING}
              AND ($2::uuid IS NULL OR n.country_id = $2)) AS notions,
           (SELECT count(*)::int FROM exercise_intents e JOIN notions n ON n.id = e.notion_id
              WHERE ${EXERCISE_PENDING} AND ($2::uuid IS NULL OR n.country_id = $2)) AS exercises,
           (SELECT count(*)::int FROM contact_requests WHERE handled_at IS NULL) AS contacts`,
        [library, filter.countryId ?? null],
      );
      const r = rows[0];
      const notions = r?.notions ?? 0;
      const exercises = r?.exercises ?? 0;
      return {
        toReview: notions + exercises,
        notions,
        exercises,
        contacts: r?.contacts ?? 0,
      };
    },
  };
}
