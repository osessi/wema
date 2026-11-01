import type { EventId, LearnerId, LearningEvent, Result } from "@wema/domain";
import { asLearnerId, err, ok, parseLearningEvent } from "@wema/domain";
import type { SqlExecutor } from "./executor";

export type AppendError = { kind: "id_conflict"; id: EventId };

export interface EventStore {
  /** Idempotent : renvoyer le même événement ne crée pas de doublon. */
  append(
    event: LearningEvent,
  ): Promise<Result<{ inserted: boolean }, AppendError>>;
  /** Dernière activité de chaque élève qui a au moins un événement. */
  lastActivityByLearner(): Promise<
    { learnerId: LearnerId; lastActivityAt: Date }[]
  >;
  /** Événements d'un élève, triés par date puis par identifiant. */
  listByLearner(learnerId: LearnerId): Promise<LearningEvent[]>;
}

interface Row {
  id: string;
  learner_id: string;
  occurred_at: Date;
  source: string;
  payload: unknown;
}

export function createEventStore(db: SqlExecutor): EventStore {
  return {
    async append(event) {
      const params = [
        event.id,
        event.learnerId,
        event.occurredAt.toISOString(),
        event.source,
        JSON.stringify(event.payload),
      ];
      const inserted = await db.query(
        `INSERT INTO learning_events (id, learner_id, occurred_at, source, type, payload)
         VALUES ($1, $2, $3, $4, $5::jsonb->>'type', $5::jsonb)
         ON CONFLICT (id) DO NOTHING
         RETURNING id`,
        params,
      );
      if (inserted.rows.length > 0) return ok({ inserted: true });

      const same = await db.query(
        `SELECT 1 FROM learning_events
         WHERE id = $1 AND learner_id = $2 AND occurred_at = $3
           AND source = $4 AND payload = $5::jsonb`,
        params,
      );
      return same.rows.length > 0
        ? ok({ inserted: false })
        : err({ kind: "id_conflict", id: event.id });
    },

    async lastActivityByLearner() {
      const { rows } = await db.query<{ learner_id: string; last: Date }>(
        "SELECT learner_id, max(occurred_at) AS last FROM learning_events GROUP BY learner_id",
      );
      return rows.map((r) => ({
        learnerId: asLearnerId(r.learner_id),
        lastActivityAt: r.last,
      }));
    },

    async listByLearner(learnerId) {
      const { rows } = await db.query<Row>(
        `SELECT id, learner_id, occurred_at, source, payload
         FROM learning_events WHERE learner_id = $1
         ORDER BY occurred_at, id`,
        [learnerId],
      );
      return rows.map((row) => {
        const parsed = parseLearningEvent({
          id: row.id,
          learnerId: row.learner_id,
          occurredAt: row.occurred_at,
          source: row.source,
          payload: row.payload,
        });
        if (!parsed.ok) {
          throw new Error(
            `Événement ${row.id} invalide en base : ${parsed.error}`,
          );
        }
        return parsed.value;
      });
    },
  };
}
