import { randomUUID } from "node:crypto";
import type { LearnerId, NotionId } from "@wema/domain";
import { asNotionId } from "@wema/domain";
import type { SqlExecutor } from "./executor";

export interface Nudge {
  id: string;
  /** Jour de la relance, AAAA-MM-JJ. */
  day: string;
  reason: string;
  notionId: NotionId | null;
  content: string;
  status: "ready" | "read";
  createdAt: Date;
}

interface NudgeRow {
  id: string;
  day: string;
  reason: string;
  notion_id: string | null;
  content: string;
  status: "ready" | "read";
  created_at: Date;
}

const COLUMNS =
  "id, to_char(day, 'YYYY-MM-DD') AS day, reason, notion_id, content, status, created_at";
const toNudge = (r: NudgeRow): Nudge => ({
  id: r.id,
  day: r.day,
  reason: r.reason,
  notionId: r.notion_id === null ? null : asNotionId(r.notion_id),
  content: r.content,
  status: r.status,
  createdAt: r.created_at,
});

export function createNudgeStore(db: SqlExecutor) {
  return {
    async hasNudgeOn(learnerId: LearnerId, day: string): Promise<boolean> {
      const { rows } = await db.query(
        "SELECT 1 FROM nudges WHERE learner_id = $1 AND day = $2::date",
        [learnerId, day],
      );
      return rows.length > 0;
    },

    /** Prépare une relance ; `null` s'il y en a déjà une ce jour-là (une seule par jour). */
    async create(input: {
      learnerId: LearnerId;
      day: string;
      reason: string;
      notionId: NotionId | null;
      content: string;
    }): Promise<Nudge | null> {
      const { rows } = await db.query<NudgeRow>(
        `INSERT INTO nudges (id, learner_id, day, reason, notion_id, content) VALUES ($1, $2, $3::date, $4, $5, $6)
         ON CONFLICT (learner_id, day) DO NOTHING RETURNING ${COLUMNS}`,
        [
          randomUUID(),
          input.learnerId,
          input.day,
          input.reason,
          input.notionId,
          input.content,
        ],
      );
      return rows[0] ? toNudge(rows[0]) : null;
    },

    async listForLearner(learnerId: LearnerId): Promise<Nudge[]> {
      const { rows } = await db.query<NudgeRow>(
        `SELECT ${COLUMNS} FROM nudges WHERE learner_id = $1 ORDER BY created_at DESC LIMIT 50`,
        [learnerId],
      );
      return rows.map(toNudge);
    },

    /** Marque une relance de l'élève comme lue ; faux si elle n'est pas à lui. */
    async markRead(id: string, learnerId: LearnerId): Promise<boolean> {
      const { rows } = await db.query(
        "UPDATE nudges SET status = 'read', read_at = coalesce(read_at, now()) WHERE id = $1 AND learner_id = $2 RETURNING id",
        [id, learnerId],
      );
      return rows.length > 0;
    },
  };
}

export type NudgeStore = ReturnType<typeof createNudgeStore>;
