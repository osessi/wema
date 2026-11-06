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
  /**
   * Dernière activité de chaque élève qui a au moins un événement ; avec
   * `inactiveSince`, seulement ceux sans activité depuis cette date.
   */
  lastActivityByLearner(options?: {
    inactiveSince?: Date;
  }): Promise<{ learnerId: LearnerId; lastActivityAt: Date }[]>;
  /** Événements d'un élève, triés par date puis par identifiant. */
  listByLearner(learnerId: LearnerId): Promise<LearningEvent[]>;
  /**
   * Journaux de plusieurs élèves en une requête (carte de classe, vue d'école) :
   * chacun trié comme `listByLearner`, vide pour un élève sans événement.
   */
  listByLearners(
    learnerIds: readonly LearnerId[],
  ): Promise<Map<LearnerId, LearningEvent[]>>;
}

interface Row {
  id: string;
  learner_id: string;
  occurred_at: Date;
  source: string;
  payload: unknown;
}

function toEvent(row: Row): LearningEvent {
  const parsed = parseLearningEvent({
    id: row.id,
    learnerId: row.learner_id,
    occurredAt: row.occurred_at,
    source: row.source,
    payload: row.payload,
  });
  if (!parsed.ok) {
    throw new Error(`Événement ${row.id} invalide en base : ${parsed.error}`);
  }
  return parsed.value;
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

    async lastActivityByLearner(options) {
      const { rows } = await db.query<{ learner_id: string; last: Date }>(
        `SELECT learner_id, max(occurred_at) AS last FROM learning_events GROUP BY learner_id
         HAVING $1::timestamptz IS NULL OR max(occurred_at) < $1
         ORDER BY learner_id`,
        [options?.inactiveSince?.toISOString() ?? null],
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
      return rows.map(toEvent);
    },

    async listByLearners(learnerIds) {
      const result = new Map<LearnerId, LearningEvent[]>(
        learnerIds.map((id) => [id, []]),
      );
      if (learnerIds.length === 0) return result;
      const { rows } = await db.query<Row>(
        `SELECT id, learner_id, occurred_at, source, payload
         FROM learning_events WHERE learner_id = ANY($1::uuid[])
         ORDER BY learner_id, occurred_at, id`,
        [learnerIds],
      );
      // Identifiants comparés sous forme normalisée (Postgres rend des minuscules).
      const byNormalized = new Map(
        learnerIds.map((id) => [id.toLowerCase(), id]),
      );
      for (const row of rows) {
        const key = byNormalized.get(row.learner_id.toLowerCase());
        if (key) result.get(key)?.push(toEvent(row));
      }
      return result;
    },
  };
}
