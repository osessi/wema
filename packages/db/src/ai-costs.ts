import { randomUUID } from "node:crypto";
import type { SqlExecutor } from "./executor";

type Num = number | string | bigint | null;
const n = (v: Num) => Number(v ?? 0);

export interface Period {
  from: Date;
  to: Date;
}

export interface DailyCost {
  /** Jour (UTC), au format AAAA-MM-JJ. */
  day: string;
  calls: number;
  errors: number;
  costUsd: number;
}

export interface OrganizationCost {
  organizationId: string | null;
  organizationName: string | null;
  calls: number;
  costUsd: number;
}

export interface SubjectCost {
  subjectId: string;
  subjectName: string;
  /** Clé d'icône de la matière (`SubjectIcon`). */
  subjectIcon: string | null;
  /** Élèves actifs dans la matière sur la période. */
  activeLearners: number;
  /** Coût attribué à la matière (estimation, voir `bySubject`). */
  costUsd: number;
  costPerLearnerUsd: number;
}

export interface LearnerCostSummary {
  totalCostUsd: number;
  /** Coût des appels rattachés à un élève. */
  learnerCostUsd: number;
  /** Élèves avec au moins un événement d'apprentissage ou un appel d'IA sur la période. */
  activeLearners: number;
  /** Coût total divisé par le nombre d'élèves actifs. */
  costPerActiveLearnerUsd: number;
}

/** Plafond mensuel : global (organizationId null) ou pour une organisation. */
export interface SpendingCap {
  organizationId: string | null;
  organizationName: string | null;
  monthlyUsd: number;
  /** Part du plafond à partir de laquelle une alerte est levée (0 à 1). */
  alertRatio: number;
  updatedAt: Date;
}

export interface SpendingAlert {
  organizationId: string | null;
  organizationName: string | null;
  month: string;
  level: "warning" | "blocked";
  spentUsd: number;
  capUsd: number;
  at: Date;
}

/** Premier jour du mois (UTC) de la date donnée. */
export function monthStart(at: Date): Date {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
}

const NIL = "00000000-0000-0000-0000-000000000000";

/** Coûts de l'IA : tableaux de bord et plafonds de dépense. */
export function createAiCostStore(db: SqlExecutor) {
  const range = (p: Period) => [p.from.toISOString(), p.to.toISOString()];

  return {
    async daily(p: Period): Promise<DailyCost[]> {
      const { rows } = await db.query<{
        day: string;
        calls: number;
        errors: number;
        cost: Num;
      }>(
        `SELECT to_char((at AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS day, count(*)::int AS calls,
           count(*) FILTER (WHERE status = 'error')::int AS errors, coalesce(sum(cost_usd), 0) AS cost
         FROM ai_calls WHERE at >= $1 AND at < $2 GROUP BY 1 ORDER BY 1`,
        range(p),
      );
      return rows.map((r) => ({
        day: r.day,
        calls: r.calls,
        errors: r.errors,
        costUsd: n(r.cost),
      }));
    },

    async byOrganization(p: Period): Promise<OrganizationCost[]> {
      const { rows } = await db.query<{
        id: string | null;
        name: string | null;
        calls: number;
        cost: Num;
      }>(
        `SELECT a.organization_id AS id, o.name, count(*)::int AS calls, coalesce(sum(a.cost_usd), 0) AS cost
         FROM ai_calls a LEFT JOIN organizations o ON o.id = a.organization_id
         WHERE a.at >= $1 AND a.at < $2 GROUP BY 1, 2 ORDER BY cost DESC, calls DESC`,
        range(p),
      );
      return rows.map((r) => ({
        organizationId: r.id,
        organizationName: r.name,
        calls: r.calls,
        costUsd: n(r.cost),
      }));
    },

    async learnerSummary(p: Period): Promise<LearnerCostSummary> {
      const { rows } = await db.query<{
        total: Num;
        learner_cost: Num;
        active: number;
      }>(
        `SELECT
           (SELECT coalesce(sum(cost_usd), 0) FROM ai_calls WHERE at >= $1 AND at < $2) AS total,
           (SELECT coalesce(sum(cost_usd), 0) FROM ai_calls WHERE at >= $1 AND at < $2 AND learner_id IS NOT NULL) AS learner_cost,
           (SELECT count(DISTINCT id)::int FROM (
              SELECT learner_id AS id FROM learning_events WHERE occurred_at >= $1 AND occurred_at < $2
              UNION SELECT learner_id FROM ai_calls WHERE at >= $1 AND at < $2 AND learner_id IS NOT NULL
            ) x) AS active`,
        range(p),
      );
      const r = rows[0];
      const total = n(r?.total ?? 0);
      const active = r?.active ?? 0;
      return {
        totalCostUsd: total,
        learnerCostUsd: n(r?.learner_cost ?? 0),
        activeLearners: active,
        costPerActiveLearnerUsd: active > 0 ? total / active : 0,
      };
    },

    /**
     * Coût par matière, estimé : le coût des appels d'un élève sur une journée
     * est réparti entre les matières de ses événements d'apprentissage de ce
     * jour-là (au prorata). Un appel sans élève, ou un jour sans événement, ne
     * peut pas être attribué : il reste dans le total, pas dans une matière.
     */
    async bySubject(p: Period): Promise<SubjectCost[]> {
      const { rows } = await db.query<{
        subject_id: string;
        subject_name: string;
        subject_icon: string | null;
        active: number;
        cost: Num;
      }>(
        `WITH calls AS (
           SELECT learner_id, (at AT TIME ZONE 'UTC')::date AS day, coalesce(sum(cost_usd), 0) AS cost
           FROM ai_calls WHERE at >= $1 AND at < $2 AND learner_id IS NOT NULL GROUP BY 1, 2
         ), ev AS (
           SELECT e.learner_id, (e.occurred_at AT TIME ZONE 'UTC')::date AS day, pr.subject_id, count(*) AS events
           FROM learning_events e
           JOIN notions nn ON nn.id::text = e.payload->>'notionId'
           JOIN units u ON u.id = nn.unit_id JOIN programs pr ON pr.id = u.program_id
           WHERE e.occurred_at >= $1 AND e.occurred_at < $2
           GROUP BY 1, 2, 3
         ), share AS (
           SELECT learner_id, day, subject_id,
             events::double precision / sum(events) OVER (PARTITION BY learner_id, day) AS w
           FROM ev
         ), attributed AS (
           SELECT s.subject_id, sum(c.cost * s.w) AS cost
           FROM calls c JOIN share s ON s.learner_id = c.learner_id AND s.day = c.day
           GROUP BY 1
         ), active AS (
           SELECT subject_id, count(DISTINCT learner_id)::int AS learners FROM ev GROUP BY 1
         )
         SELECT su.id AS subject_id, su.name AS subject_name, su.icon AS subject_icon, a.learners AS active, coalesce(t.cost, 0) AS cost
         FROM active a JOIN subjects su ON su.id = a.subject_id
         LEFT JOIN attributed t ON t.subject_id = a.subject_id
         ORDER BY cost DESC`,
        range(p),
      );
      return rows.map((r) => {
        const cost = n(r.cost);
        return {
          subjectId: r.subject_id,
          subjectName: r.subject_name,
          subjectIcon: r.subject_icon,
          activeLearners: r.active,
          costUsd: cost,
          costPerLearnerUsd: r.active > 0 ? cost / r.active : 0,
        };
      });
    },

    /** Dépense du mois en cours (depuis `since`) : globale et, si demandée, d'une organisation. */
    async spentSince(
      since: Date,
      organizationId: string | null,
    ): Promise<{ global: number; organization: number | null }> {
      const { rows } = await db.query<{ global: Num; org: Num }>(
        `SELECT coalesce(sum(cost_usd), 0) AS global,
           coalesce(sum(cost_usd) FILTER (WHERE organization_id = $2::uuid), 0) AS org
         FROM ai_calls WHERE at >= $1`,
        [since.toISOString(), organizationId],
      );
      return {
        global: n(rows[0]?.global ?? 0),
        organization: organizationId === null ? null : n(rows[0]?.org ?? 0),
      };
    },

    async listCaps(): Promise<SpendingCap[]> {
      const { rows } = await db.query<{
        organization_id: string | null;
        name: string | null;
        monthly_usd: Num;
        alert_ratio: number;
        updated_at: Date;
      }>(
        `SELECT c.organization_id, o.name, c.monthly_usd, c.alert_ratio, c.updated_at
         FROM ai_spending_caps c LEFT JOIN organizations o ON o.id = c.organization_id
         ORDER BY c.organization_id NULLS FIRST, o.name`,
      );
      return rows.map((r) => ({
        organizationId: r.organization_id,
        organizationName: r.name,
        monthlyUsd: n(r.monthly_usd),
        alertRatio: r.alert_ratio,
        updatedAt: r.updated_at,
      }));
    },

    /** Plafonds qui s'appliquent à un appel : le global et celui de l'organisation. */
    async capsFor(organizationId: string | null): Promise<{
      global: Pick<SpendingCap, "monthlyUsd" | "alertRatio"> | null;
      organization: Pick<SpendingCap, "monthlyUsd" | "alertRatio"> | null;
    }> {
      const { rows } = await db.query<{
        organization_id: string | null;
        monthly_usd: Num;
        alert_ratio: number;
      }>(
        `SELECT organization_id, monthly_usd, alert_ratio FROM ai_spending_caps
         WHERE organization_id IS NULL OR organization_id = $1::uuid`,
        [organizationId],
      );
      const pick = (r: (typeof rows)[number] | undefined) =>
        r ? { monthlyUsd: n(r.monthly_usd), alertRatio: r.alert_ratio } : null;
      return {
        global: pick(rows.find((r) => r.organization_id === null)),
        organization:
          organizationId === null
            ? null
            : pick(rows.find((r) => r.organization_id === organizationId)),
      };
    },

    async setCap(input: {
      organizationId: string | null;
      monthlyUsd: number;
      alertRatio: number;
      updatedBy: string | null;
    }): Promise<void> {
      await db.query(
        `INSERT INTO ai_spending_caps (id, organization_id, monthly_usd, alert_ratio, updated_by)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT ((coalesce(organization_id, '${NIL}'::uuid)))
         DO UPDATE SET monthly_usd = EXCLUDED.monthly_usd, alert_ratio = EXCLUDED.alert_ratio,
           updated_by = EXCLUDED.updated_by, updated_at = now()`,
        [
          randomUUID(),
          input.organizationId,
          input.monthlyUsd,
          input.alertRatio,
          input.updatedBy,
        ],
      );
    },

    /** Retire un plafond ; renvoie faux s'il n'existait pas. */
    async removeCap(organizationId: string | null): Promise<boolean> {
      // Table de réglages (pas un journal) : un plafond retiré n'a plus de raison d'être.
      const { rows } = await db.query(
        `DELETE FROM ai_spending_caps WHERE coalesce(organization_id, '${NIL}'::uuid) = coalesce($1::uuid, '${NIL}'::uuid)
         RETURNING 1`,
        [organizationId],
      );
      return rows.length > 0;
    },

    /** Note une alerte, une seule fois par portée, mois et niveau ; vrai si elle est nouvelle. */
    async recordAlert(input: {
      organizationId: string | null;
      month: Date;
      level: "warning" | "blocked";
      spentUsd: number;
      capUsd: number;
    }): Promise<boolean> {
      const { rows } = await db.query(
        `INSERT INTO ai_spending_alerts (id, organization_id, month, level, spent_usd, cap_usd)
         VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING RETURNING 1`,
        [
          randomUUID(),
          input.organizationId,
          input.month.toISOString().slice(0, 10),
          input.level,
          input.spentUsd,
          input.capUsd,
        ],
      );
      return rows.length > 0;
    },

    async listAlerts(since: Date): Promise<SpendingAlert[]> {
      const { rows } = await db.query<{
        organization_id: string | null;
        name: string | null;
        month: string;
        level: "warning" | "blocked";
        spent_usd: Num;
        cap_usd: Num;
        at: Date;
      }>(
        `SELECT a.organization_id, o.name, to_char(a.month, 'YYYY-MM') AS month, a.level, a.spent_usd, a.cap_usd, a.at
         FROM ai_spending_alerts a LEFT JOIN organizations o ON o.id = a.organization_id
         WHERE a.month >= $1::date ORDER BY a.at DESC`,
        [since.toISOString().slice(0, 10)],
      );
      return rows.map((r) => ({
        organizationId: r.organization_id,
        organizationName: r.name,
        month: r.month,
        level: r.level,
        spentUsd: n(r.spent_usd),
        capUsd: n(r.cap_usd),
        at: r.at,
      }));
    },
  };
}

export type AiCostStore = ReturnType<typeof createAiCostStore>;
