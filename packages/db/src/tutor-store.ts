import { randomUUID } from "node:crypto";
import type {
  ExerciseVariantId,
  LearnerId,
  NotionId,
  SubjectId,
  TutorMessage,
  TutorMode,
  TutorSession,
} from "@wema/domain";
import { asExerciseVariantId, asLearnerId, asNotionId } from "@wema/domain";
import type { SqlExecutor } from "./executor";

interface SessionRow {
  id: string;
  learner_id: string;
  notion_id: string | null;
  variant_id: string | null;
  mode: TutorMode;
  hint_level: number;
  status: "open" | "finishing" | "finished";
  created_at: Date;
}
const SESSION_COLUMNS =
  "id, learner_id, notion_id, variant_id, mode, hint_level, status, created_at";

const toSession = (r: SessionRow): TutorSession => ({
  id: r.id,
  learnerId: asLearnerId(r.learner_id),
  notionId: r.notion_id === null ? null : asNotionId(r.notion_id),
  variantId: r.variant_id === null ? null : asExerciseVariantId(r.variant_id),
  mode: r.mode,
  hintLevel: r.hint_level,
  // Une fin en cours est encore une séance ouverte vue de l'extérieur.
  status: r.status === "finished" ? "finished" : "open",
  createdAt: r.created_at,
});

export function createTutorStore(db: SqlExecutor) {
  return {
    async createSession(input: {
      learnerId: LearnerId;
      notionId: NotionId | null;
      variantId: ExerciseVariantId | null;
      mode: TutorMode;
    }): Promise<TutorSession> {
      const { rows } = await db.query<SessionRow>(
        `INSERT INTO tutor_sessions (id, learner_id, notion_id, variant_id, mode) VALUES ($1, $2, $3, $4, $5)
         RETURNING ${SESSION_COLUMNS}`,
        [
          randomUUID(),
          input.learnerId,
          input.notionId,
          input.variantId,
          input.mode,
        ],
      );
      const row = rows[0];
      if (!row) throw new Error("création de séance sans retour");
      return toSession(row);
    },

    async getSession(id: string): Promise<TutorSession | null> {
      const { rows } = await db.query<SessionRow>(
        `SELECT ${SESSION_COLUMNS} FROM tutor_sessions WHERE id = $1`,
        [id],
      );
      return rows[0] ? toSession(rows[0]) : null;
    },

    async listSessions(learnerId: LearnerId): Promise<TutorSession[]> {
      const { rows } = await db.query<SessionRow>(
        `SELECT ${SESSION_COLUMNS} FROM tutor_sessions WHERE learner_id = $1 ORDER BY created_at DESC LIMIT 100`,
        [learnerId],
      );
      return rows.map(toSession);
    },

    /** Passe au niveau d'indice donné, seulement en montant (deux demandes simultanées ne reculent pas). */
    async raiseHintLevel(id: string, level: number): Promise<void> {
      await db.query(
        "UPDATE tutor_sessions SET hint_level = greatest(hint_level, $2) WHERE id = $1",
        [id, level],
      );
    },

    /** Réserve la fin de séance ; faux si une autre demande l'a déjà réservée ou si elle est terminée. */
    async claimFinish(id: string): Promise<boolean> {
      const { rows } = await db.query(
        "UPDATE tutor_sessions SET status = 'finishing' WHERE id = $1 AND status = 'open' RETURNING id",
        [id],
      );
      return rows.length > 0;
    },

    /** Annule une réservation (l'évaluation a échoué) : la séance redevient ouverte. */
    async releaseFinish(id: string): Promise<void> {
      await db.query(
        "UPDATE tutor_sessions SET status = 'open' WHERE id = $1 AND status = 'finishing'",
        [id],
      );
    },

    /** Termine la séance ; faux si elle l'était déjà. */
    async finishSession(id: string): Promise<boolean> {
      const { rows } = await db.query(
        "UPDATE tutor_sessions SET status = 'finished', finished_at = now() WHERE id = $1 AND status <> 'finished' RETURNING id",
        [id],
      );
      return rows.length > 0;
    },

    /** Séance réservée pour sa fin (aucun nouveau message accepté). */
    async isFinishing(id: string): Promise<boolean> {
      const { rows } = await db.query(
        "SELECT 1 FROM tutor_sessions WHERE id = $1 AND status = 'finishing'",
        [id],
      );
      return rows.length > 0;
    },

    async countMessages(sessionId: string): Promise<number> {
      const { rows } = await db.query<{ n: number }>(
        "SELECT count(*)::int AS n FROM tutor_messages WHERE session_id = $1",
        [sessionId],
      );
      return rows[0]?.n ?? 0;
    },

    async addMessage(input: {
      sessionId: string;
      role: "learner" | "tutor";
      content: string;
      guarded: boolean;
    }): Promise<TutorMessage> {
      const { rows } = await db.query<{ id: string; created_at: Date }>(
        `INSERT INTO tutor_messages (id, session_id, role, content, guarded) VALUES ($1, $2, $3, $4, $5)
         RETURNING id, created_at`,
        [
          randomUUID(),
          input.sessionId,
          input.role,
          input.content,
          input.guarded,
        ],
      );
      const row = rows[0];
      if (!row) throw new Error("ajout de message sans retour");
      return { ...input, id: row.id, createdAt: row.created_at };
    },

    async listMessages(sessionId: string): Promise<TutorMessage[]> {
      const { rows } = await db.query<{
        id: string;
        session_id: string;
        role: "learner" | "tutor";
        content: string;
        guarded: boolean;
        created_at: Date;
      }>(
        "SELECT id, session_id, role, content, guarded, created_at FROM tutor_messages WHERE session_id = $1 ORDER BY seq",
        [sessionId],
      );
      return rows.map((r) => ({
        id: r.id,
        sessionId: r.session_id,
        role: r.role,
        content: r.content,
        guarded: r.guarded,
        createdAt: r.created_at,
      }));
    },

    async getTutorInstructions(subjectId: SubjectId): Promise<string> {
      const { rows } = await db.query<{ tutor_instructions: string }>(
        "SELECT tutor_instructions FROM subjects WHERE id = $1",
        [subjectId],
      );
      return rows[0]?.tutor_instructions ?? "";
    },

    /** Faux si la matière n'existe pas. */
    async setTutorInstructions(
      subjectId: SubjectId,
      instructions: string,
    ): Promise<boolean> {
      const { rows } = await db.query(
        "UPDATE subjects SET tutor_instructions = $2 WHERE id = $1 RETURNING id",
        [subjectId, instructions],
      );
      return rows.length > 0;
    },
  };
}

export type TutorStore = ReturnType<typeof createTutorStore>;
