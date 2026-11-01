import { randomUUID } from "node:crypto";
import type { SqlExecutor } from "./executor";

/** Appel à un modèle d'IA, tel que journalisé par la passerelle. */
export interface AiCallRecord {
  task: string;
  provider: string;
  model: string;
  organizationId: string | null;
  learnerId: string | null;
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
  latencyMs: number;
  status: "ok" | "error";
  errorKind: string | null;
}

export interface AiUsageRow {
  /** Valeur du regroupement (tâche, modèle ou organisation). */
  key: string | null;
  calls: number;
  errors: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  avgLatencyMs: number;
}

const GROUPS = {
  task: "task",
  model: "model",
  organization: "organization_id::text",
} as const;

export function createAiCallLog(db: SqlExecutor) {
  return {
    async append(call: AiCallRecord): Promise<void> {
      await db.query(
        `INSERT INTO ai_calls (id, task, provider, model, organization_id, learner_id, input_tokens, output_tokens,
           cost_usd, latency_ms, status, error_kind)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          randomUUID(),
          call.task,
          call.provider,
          call.model,
          call.organizationId,
          call.learnerId,
          call.inputTokens,
          call.outputTokens,
          call.costUsd,
          call.latencyMs,
          call.status,
          call.errorKind,
        ],
      );
    },

    /** Synthèse des appels d'une période, regroupés par tâche, modèle ou organisation. */
    async usage(input: {
      from: Date;
      to: Date;
      groupBy: keyof typeof GROUPS;
    }): Promise<AiUsageRow[]> {
      const column = GROUPS[input.groupBy];
      const { rows } = await db.query<{
        key: string | null;
        calls: number;
        errors: number;
        input_tokens: number;
        output_tokens: number;
        cost_usd: string | number | null;
        avg_latency_ms: string | number | null;
      }>(
        `SELECT ${column} AS key, count(*)::int AS calls,
           count(*) FILTER (WHERE status = 'error')::int AS errors,
           coalesce(sum(input_tokens), 0)::int AS input_tokens,
           coalesce(sum(output_tokens), 0)::int AS output_tokens,
           coalesce(sum(cost_usd), 0) AS cost_usd,
           coalesce(avg(latency_ms), 0) AS avg_latency_ms
         FROM ai_calls WHERE at >= $1 AND at < $2
         GROUP BY 1 ORDER BY cost_usd DESC NULLS LAST, calls DESC`,
        [input.from.toISOString(), input.to.toISOString()],
      );
      return rows.map((r) => ({
        key: r.key,
        calls: r.calls,
        errors: r.errors,
        inputTokens: r.input_tokens,
        outputTokens: r.output_tokens,
        costUsd: Number(r.cost_usd ?? 0),
        avgLatencyMs: Math.round(Number(r.avg_latency_ms ?? 0)),
      }));
    },
  };
}

export type AiCallLog = ReturnType<typeof createAiCallLog>;
