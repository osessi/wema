import type { LearnerId, TutorPersona } from "@wema/domain";
import { isTutorAvatar } from "@wema/domain";
import type { SqlExecutor } from "./executor";

/** Prof IA personnalisé par l'élève (migration 0032). */
export function createTutorPersonaStore(db: SqlExecutor) {
  return {
    async list(learnerId: LearnerId): Promise<TutorPersona[]> {
      const { rows } = await db.query<{
        subject_id: string | null;
        name: string;
        avatar: string;
      }>(
        `SELECT subject_id, name, avatar FROM tutor_personas
         WHERE learner_id = $1 ORDER BY subject_id NULLS FIRST`,
        [learnerId],
      );
      return rows.flatMap((r) =>
        isTutorAvatar(r.avatar)
          ? [{ subjectId: r.subject_id, name: r.name, avatar: r.avatar }]
          : [],
      );
    },

    /** Remplace le réglage (toutes les matières, ou une matière). */
    async set(learnerId: LearnerId, persona: TutorPersona): Promise<void> {
      await db.transaction(async (tx) => {
        await tx.query(
          `DELETE FROM tutor_personas WHERE learner_id = $1
           AND subject_id IS NOT DISTINCT FROM $2`,
          [learnerId, persona.subjectId],
        );
        await tx.query(
          `INSERT INTO tutor_personas (learner_id, subject_id, name, avatar)
           VALUES ($1, $2, $3, $4)`,
          [learnerId, persona.subjectId, persona.name, persona.avatar],
        );
      });
    },
  };
}
