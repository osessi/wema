import { randomUUID } from "node:crypto";
import type {
  ExerciseIntentId,
  LearnerId,
  OrganizationId,
  ProgramId,
  UserId,
} from "@wema/domain";
import {
  asExerciseIntentId,
  asLearnerId,
  asOrganizationId,
  asProgramId,
  asUserId,
} from "@wema/domain";
import type { SqlExecutor } from "./executor";

export interface SchoolClass {
  id: string;
  organizationId: OrganizationId;
  name: string;
  programId: ProgramId | null;
  archived: boolean;
}

export interface ClassMember {
  userId: UserId;
  displayName: string;
  role: "learner" | "teacher";
}

export interface Assignment {
  id: string;
  classId: string;
  intentId: ExerciseIntentId;
  title: string;
  dueAt: Date;
  createdBy: UserId | null;
}

/** Devoir vu par un élève : sa variante et son état. */
export interface LearnerAssignment extends Assignment {
  variantId: string | null;
  /** Réussi, ou essais épuisés : le devoir est rendu. */
  done: boolean;
  correct: boolean;
}

interface ClassRow {
  id: string;
  organization_id: string;
  name: string;
  program_id: string | null;
  archived_at: Date | null;
}
const CLASS_COLUMNS =
  "c.id, c.organization_id, c.name, c.program_id, c.archived_at";
/**
 * Un membre de classe ne compte que s'il est encore membre de l'organisation
 * de la classe : un prof ou un élève retiré de l'école perd aussitôt l'accès.
 */
const STILL_MEMBER =
  "EXISTS (SELECT 1 FROM memberships o WHERE o.organization_id = c.organization_id AND o.user_id = m.user_id)";
const toClass = (r: ClassRow): SchoolClass => ({
  id: r.id,
  organizationId: asOrganizationId(r.organization_id),
  name: r.name,
  programId: r.program_id === null ? null : asProgramId(r.program_id),
  archived: r.archived_at !== null,
});

interface AssignmentRow {
  id: string;
  class_id: string;
  intent_id: string;
  title: string;
  due_at: Date;
  created_by: string | null;
}
const toAssignment = (r: AssignmentRow): Assignment => ({
  id: r.id,
  classId: r.class_id,
  intentId: asExerciseIntentId(r.intent_id),
  title: r.title,
  dueAt: r.due_at,
  createdBy: r.created_by === null ? null : asUserId(r.created_by),
});

function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" && e !== null && "code" in e && e.code === "23505"
  );
}

export function createClassStore(db: SqlExecutor) {
  return {
    /** `null` si une classe porte déjà ce nom dans l'organisation. */
    async createClass(input: {
      organizationId: OrganizationId;
      name: string;
      programId: ProgramId | null;
    }): Promise<SchoolClass | null> {
      try {
        const { rows } = await db.query<ClassRow>(
          `INSERT INTO classes AS c (id, organization_id, name, program_id) VALUES ($1, $2, $3, $4)
           RETURNING ${CLASS_COLUMNS}`,
          [randomUUID(), input.organizationId, input.name, input.programId],
        );
        return rows[0] ? toClass(rows[0]) : null;
      } catch (e) {
        // Nom déjà pris, ou programme inconnu : pas de classe créée.
        if (
          isUniqueViolation(e) ||
          (typeof e === "object" &&
            e !== null &&
            "code" in e &&
            e.code === "23503")
        )
          return null;
        throw e;
      }
    },

    async getClass(id: string): Promise<SchoolClass | null> {
      const { rows } = await db.query<ClassRow>(
        `SELECT ${CLASS_COLUMNS} FROM classes c WHERE c.id = $1`,
        [id],
      );
      return rows[0] ? toClass(rows[0]) : null;
    },

    async listClasses(organizationId: OrganizationId): Promise<SchoolClass[]> {
      const { rows } = await db.query<ClassRow>(
        `SELECT ${CLASS_COLUMNS} FROM classes c WHERE c.organization_id = $1 AND c.archived_at IS NULL ORDER BY c.name`,
        [organizationId],
      );
      return rows.map(toClass);
    },

    /** Classes où l'utilisateur a ce rôle (prof ou élève). */
    async classesOf(
      userId: UserId,
      role: "learner" | "teacher",
    ): Promise<SchoolClass[]> {
      const { rows } = await db.query<ClassRow>(
        `SELECT ${CLASS_COLUMNS} FROM classes c JOIN class_members m ON m.class_id = c.id
         WHERE m.user_id = $1 AND m.role = $2 AND c.archived_at IS NULL AND ${STILL_MEMBER} ORDER BY c.name`,
        [userId, role],
      );
      return rows.map(toClass);
    },

    async isTeacherOf(classId: string, userId: UserId): Promise<boolean> {
      const { rows } = await db.query(
        `SELECT 1 FROM class_members m JOIN classes c ON c.id = m.class_id
         WHERE m.class_id = $1 AND m.user_id = $2 AND m.role = 'teacher' AND ${STILL_MEMBER}`,
        [classId, userId],
      );
      return rows.length > 0;
    },

    async addMember(input: {
      classId: string;
      userId: UserId;
      role: "learner" | "teacher";
    }): Promise<void> {
      await db.query(
        `INSERT INTO class_members (class_id, user_id, role) VALUES ($1, $2, $3)
         ON CONFLICT (class_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
        [input.classId, input.userId, input.role],
      );
    },

    async removeMember(classId: string, userId: UserId): Promise<boolean> {
      const { rows } = await db.query(
        "DELETE FROM class_members WHERE class_id = $1 AND user_id = $2 RETURNING user_id",
        [classId, userId],
      );
      return rows.length > 0;
    },

    async listMembers(classId: string): Promise<ClassMember[]> {
      const { rows } = await db.query<{
        user_id: string;
        display_name: string;
        role: "learner" | "teacher";
      }>(
        `SELECT m.user_id, u.display_name, m.role FROM class_members m JOIN users u ON u.id = m.user_id
         JOIN classes c ON c.id = m.class_id
         WHERE m.class_id = $1 AND ${STILL_MEMBER} ORDER BY m.role DESC, u.display_name`,
        [classId],
      );
      return rows.map((r) => ({
        userId: asUserId(r.user_id),
        displayName: r.display_name,
        role: r.role,
      }));
    },

    async createAssignment(input: {
      classId: string;
      intentId: ExerciseIntentId;
      title: string;
      dueAt: Date;
      createdBy: UserId;
    }): Promise<Assignment> {
      const { rows } = await db.query<AssignmentRow>(
        `INSERT INTO assignments (id, class_id, intent_id, title, due_at, created_by) VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, class_id, intent_id, title, due_at, created_by`,
        [
          randomUUID(),
          input.classId,
          input.intentId,
          input.title,
          input.dueAt.toISOString(),
          input.createdBy,
        ],
      );
      const row = rows[0];
      if (!row) throw new Error("création de devoir sans retour");
      return toAssignment(row);
    },

    async listAssignments(
      classId: string,
    ): Promise<
      (Assignment & { given: number; done: number; correct: number })[]
    > {
      const { rows } = await db.query<
        AssignmentRow & { given: number; done: number; correct: number }
      >(
        `SELECT a.id, a.class_id, a.intent_id, a.title, a.due_at, a.created_by,
           count(v.id)::int AS given,
           count(v.id) FILTER (WHERE EXISTS (SELECT 1 FROM exercise_attempts t WHERE t.variant_id = v.id AND t.correct)
             OR (SELECT count(*) FROM exercise_attempts t WHERE t.variant_id = v.id) >= 3)::int AS done,
           count(v.id) FILTER (WHERE EXISTS (SELECT 1 FROM exercise_attempts t WHERE t.variant_id = v.id AND t.correct))::int AS correct
         FROM assignments a LEFT JOIN exercise_variants v ON v.assignment_id = a.id
         WHERE a.class_id = $1 GROUP BY a.id ORDER BY a.due_at DESC`,
        [classId],
      );
      return rows.map((r) => ({
        ...toAssignment(r),
        given: r.given,
        done: r.done,
        correct: r.correct,
      }));
    },

    /** Devoirs d'un élève, avec sa variante et son état. */
    async assignmentsForLearner(
      learnerId: LearnerId,
    ): Promise<LearnerAssignment[]> {
      const { rows } = await db.query<
        AssignmentRow & {
          variant_id: string | null;
          correct: boolean;
          attempts: number;
        }
      >(
        `SELECT a.id, a.class_id, a.intent_id, a.title, a.due_at, a.created_by, v.id AS variant_id,
           EXISTS (SELECT 1 FROM exercise_attempts t WHERE t.variant_id = v.id AND t.correct) AS correct,
           (SELECT count(*)::int FROM exercise_attempts t WHERE t.variant_id = v.id) AS attempts
         FROM assignments a
         JOIN class_members m ON m.class_id = a.class_id AND m.user_id = $1 AND m.role = 'learner'
         JOIN classes c ON c.id = a.class_id AND ${STILL_MEMBER}
         LEFT JOIN exercise_variants v ON v.assignment_id = a.id AND v.learner_id = $1
         ORDER BY a.due_at`,
        [learnerId],
      );
      return rows.map((r) => ({
        ...toAssignment(r),
        variantId: r.variant_id,
        correct: r.correct,
        done: r.correct || (r.attempts ?? 0) >= 3,
      }));
    },

    async link(input: {
      organizationId: OrganizationId;
      guardianId: UserId;
      learnerId: UserId;
    }): Promise<void> {
      await db.query(
        "INSERT INTO guardianships (organization_id, guardian_id, learner_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
        [input.organizationId, input.guardianId, input.learnerId],
      );
    },

    async childrenOf(guardianId: UserId): Promise<
      {
        learnerId: LearnerId;
        displayName: string;
        organizationId: OrganizationId;
      }[]
    > {
      const { rows } = await db.query<{
        learner_id: string;
        display_name: string;
        organization_id: string;
      }>(
        `SELECT g.learner_id, u.display_name, g.organization_id FROM guardianships g JOIN users u ON u.id = g.learner_id
         WHERE g.guardian_id = $1
           -- Le lien ne vaut que tant que parent et enfant sont encore membres de la famille.
           AND EXISTS (SELECT 1 FROM memberships o WHERE o.organization_id = g.organization_id AND o.user_id = g.guardian_id)
           AND EXISTS (SELECT 1 FROM memberships o WHERE o.organization_id = g.organization_id AND o.user_id = g.learner_id)
         ORDER BY u.display_name`,
        [guardianId],
      );
      return rows.map((r) => ({
        learnerId: asLearnerId(r.learner_id),
        displayName: r.display_name,
        organizationId: asOrganizationId(r.organization_id),
      }));
    },

    async unlink(input: {
      organizationId: OrganizationId;
      guardianId: UserId;
      learnerId: UserId;
    }): Promise<boolean> {
      const { rows } = await db.query(
        "DELETE FROM guardianships WHERE organization_id = $1 AND guardian_id = $2 AND learner_id = $3 RETURNING learner_id",
        [input.organizationId, input.guardianId, input.learnerId],
      );
      return rows.length > 0;
    },

    async isGuardianOf(
      guardianId: UserId,
      learnerId: UserId,
    ): Promise<boolean> {
      const { rows } = await db.query(
        "SELECT 1 FROM guardianships WHERE guardian_id = $1 AND learner_id = $2",
        [guardianId, learnerId],
      );
      return rows.length > 0;
    },
  };
}

export type ClassStore = ReturnType<typeof createClassStore>;
