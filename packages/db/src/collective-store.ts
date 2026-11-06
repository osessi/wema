import {
  buildCollectiveInsights,
  type ExerciseInsight,
  effectiveMinLearners,
  type FormatInsight,
  type MisconceptionInsight,
  type NotionInsight,
  type RawCollectiveData,
} from "./collective";
import type { SqlExecutor } from "./executor";

/** Réponses du journal, avec la réponse suivante du même élève sur la même notion. */
const ANSWERS = `
  SELECT e.learner_id, e.payload->>'notionId' AS notion_id,
    (e.payload->>'correct')::boolean AS correct,
    coalesce(e.payload->>'format', 'text') AS format,
    CASE WHEN jsonb_typeof(e.payload->'scaffolded') = 'boolean'
      THEN (e.payload->>'scaffolded')::boolean END AS scaffolded,
    e.payload->>'exerciseRef' AS ref,
    lead((e.payload->>'correct')::boolean) OVER (
      PARTITION BY e.learner_id, e.payload->>'notionId' ORDER BY e.occurred_at, e.id
    ) AS next_correct
  FROM learning_events e WHERE e.type = 'answer.submitted'`;

const PROGRESS_COLUMNS = `count(DISTINCT a.learner_id)::int AS learners,
  count(*)::int AS answers,
  count(*) FILTER (WHERE a.correct)::int AS correct,
  count(a.next_correct)::int AS followed,
  count(*) FILTER (WHERE a.next_correct)::int AS next_correct`;

type Num = number | string | null;
const num = (v: Num) => (v === null ? null : Number(v));

/** Effectifs bruts, sans aucun identifiant d'élève ni d'organisation en sortie. */
async function readRaw(db: SqlExecutor): Promise<RawCollectiveData> {
  const notions = await db.query<{
    notion_id: string;
    learners: number;
    answers: number;
    correct: number;
    stuck: number;
    succeeded: number;
    avg_before: Num;
  }>(
    `WITH a AS (
       SELECT e.learner_id, e.payload->>'notionId' AS notion_id, e.occurred_at, e.id,
         (e.payload->>'correct')::boolean AS correct
       FROM learning_events e WHERE e.type = 'answer.submitted'
     ), r AS (
       SELECT a.*,
         row_number() OVER (PARTITION BY learner_id, notion_id ORDER BY occurred_at DESC, id DESC) AS rn_desc,
         row_number() OVER (PARTITION BY learner_id, notion_id ORDER BY occurred_at, id) AS rn
       FROM a
     ), per_learner AS (
       SELECT notion_id, learner_id, count(*) AS answers,
         count(*) FILTER (WHERE correct) AS correct,
         bool_or(correct) FILTER (WHERE rn_desc <= 3) AS recent_ok,
         min(rn) FILTER (WHERE correct) AS first_success
       FROM r GROUP BY 1, 2
     )
     SELECT p.notion_id, count(*)::int AS learners, sum(p.answers)::int AS answers,
       sum(p.correct)::int AS correct,
       count(*) FILTER (WHERE p.answers >= 3 AND NOT coalesce(p.recent_ok, false))::int AS stuck,
       count(p.first_success)::int AS succeeded,
       avg(p.first_success - 1) AS avg_before
     FROM per_learner p JOIN notions n ON n.id::text = p.notion_id
     GROUP BY 1`,
  );

  const misconceptions = await db.query<{
    notion_id: string;
    misconception_id: string;
    description: string;
    learners: number;
  }>(
    `WITH x AS (
       SELECT learner_id, payload->>'notionId' AS notion_id, payload->>'misconceptionId' AS misconception_id
       FROM learning_events
       WHERE type IN ('answer.submitted', 'copy.reviewed') AND payload->>'misconceptionId' IS NOT NULL
       UNION ALL
       SELECT learner_id, payload->>'notionId', jsonb_array_elements_text(payload->'misconceptionIds')
       FROM learning_events WHERE type IN ('teachback.assessed', 'oralcheck.assessed')
     )
     SELECT x.notion_id, x.misconception_id, m.description, count(DISTINCT x.learner_id)::int AS learners
     FROM x JOIN misconceptions m ON m.id::text = x.misconception_id AND m.notion_id::text = x.notion_id
     WHERE m.archived_at IS NULL
     GROUP BY 1, 2, 3`,
  );

  const formats = await db.query<{
    notion_id: string;
    format: string;
    scaffolded: boolean | null;
    learners: number;
    answers: number;
    correct: number;
    followed: number;
    next_correct: number;
  }>(
    `WITH a AS (${ANSWERS})
     SELECT a.notion_id, a.format, coalesce(a.scaffolded, v.scaffolded) AS scaffolded, ${PROGRESS_COLUMNS}
     FROM a JOIN notions n ON n.id::text = a.notion_id
     LEFT JOIN exercise_variants v ON v.id::text = a.ref
     GROUP BY 1, 2, 3`,
  );

  // Seuls les exercices de la bibliothèque commune de Wema sont nommés : ceux
  // d'une organisation restent les siens.
  const exercises = await db.query<{
    notion_id: string;
    intent_id: string;
    objective: string;
    learners: number;
    answers: number;
    correct: number;
    followed: number;
    next_correct: number;
  }>(
    `WITH a AS (${ANSWERS})
     SELECT a.notion_id, i.id::text AS intent_id, i.objective, ${PROGRESS_COLUMNS}
     FROM a
     JOIN exercise_variants v ON v.id::text = a.ref
     JOIN exercise_intents i ON i.id = v.intent_id AND i.notion_id::text = a.notion_id
     JOIN organizations o ON o.id = i.organization_id AND o.kind = 'platform'
     GROUP BY 1, 2, 3`,
  );

  const tutor = await db.query<{
    notion_id: string;
    learners: number;
    avg_seconds: Num;
  }>(
    `WITH s AS (
       SELECT s.notion_id, s.learner_id,
         -- Une séance laissée ouverte compte pour deux heures au plus.
         least(extract(epoch FROM max(m.created_at) - s.created_at), 7200) AS seconds
       FROM tutor_sessions s JOIN tutor_messages m ON m.session_id = s.id
       GROUP BY s.id, s.notion_id, s.learner_id, s.created_at
       HAVING count(m.id) >= 2
     )
     SELECT notion_id::text, count(DISTINCT learner_id)::int AS learners, avg(seconds) AS avg_seconds
     FROM s GROUP BY 1`,
  );

  return {
    notions: notions.rows.map((r) => ({
      notionId: r.notion_id,
      learners: r.learners,
      answers: r.answers,
      correct: r.correct,
      stuck: r.stuck,
      succeededLearners: r.succeeded,
      avgAnswersBeforeSuccess: num(r.avg_before),
    })),
    misconceptions: misconceptions.rows.map((r) => ({
      notionId: r.notion_id,
      misconceptionId: r.misconception_id,
      description: r.description,
      learners: r.learners,
    })),
    formats: formats.rows.map((r) => ({
      notionId: r.notion_id,
      format: r.format,
      scaffolded: r.scaffolded,
      learners: r.learners,
      answers: r.answers,
      correct: r.correct,
      followed: r.followed,
      nextCorrect: r.next_correct,
    })),
    exercises: exercises.rows.map((r) => ({
      notionId: r.notion_id,
      intentId: r.intent_id,
      objective: r.objective,
      learners: r.learners,
      answers: r.answers,
      correct: r.correct,
      followed: r.followed,
      nextCorrect: r.next_correct,
    })),
    tutor: tutor.rows.map((r) => ({
      notionId: r.notion_id,
      learners: r.learners,
      avgSeconds: num(r.avg_seconds) ?? 0,
    })),
  };
}

/** Agrégat stocké, avec ce qui situe la notion dans le référentiel. */
export interface StoredNotionInsight extends NotionInsight {
  computedAt: Date;
  minLearners: number;
  notionCode: string;
  notionName: string;
  countryId: string;
  countryName: string;
  subjectId: string;
  subjectName: string;
  gradeName: string;
}

interface InsightRow {
  notion_id: string;
  computed_at: Date;
  min_learners: number;
  learners: number;
  answers: number;
  success_rate: number;
  stuck_rate: number;
  avg_answers_to_success: number | null;
  avg_tutor_seconds: number | null;
  misconceptions: MisconceptionInsight[];
  formats: FormatInsight[];
  exercises: ExerciseInsight[];
  notion_code: string;
  notion_name: string;
  country_id: string;
  country_name: string;
  subject_id: string;
  subject_name: string;
  grade_name: string;
}

const SELECT_INSIGHTS = `SELECT ci.*, n.code AS notion_code, n.name AS notion_name,
    c.id AS country_id, c.name AS country_name, s.id AS subject_id, s.name AS subject_name,
    g.name AS grade_name
  FROM collective_insights ci
  JOIN notions n ON n.id = ci.notion_id
  JOIN countries c ON c.id = n.country_id
  JOIN units u ON u.id = n.unit_id
  JOIN programs p ON p.id = u.program_id
  JOIN subjects s ON s.id = p.subject_id
  JOIN grades g ON g.id = p.grade_id`;

const toInsight = (r: InsightRow): StoredNotionInsight => ({
  notionId: r.notion_id,
  computedAt: r.computed_at,
  minLearners: r.min_learners,
  learners: r.learners,
  answers: r.answers,
  successRate: r.success_rate,
  stuckRate: r.stuck_rate,
  avgAnswersToSuccess: r.avg_answers_to_success,
  avgTutorSeconds: r.avg_tutor_seconds,
  misconceptions: r.misconceptions,
  formats: r.formats,
  exercises: r.exercises,
  notionCode: r.notion_code,
  notionName: r.notion_name,
  countryId: r.country_id,
  countryName: r.country_name,
  subjectId: r.subject_id,
  subjectName: r.subject_name,
  gradeName: r.grade_name,
});

/** Réglage qui garde la date du dernier calcul des agrégats. */
const LAST_RUN_KEY = "collective_insights.last_run";

export function createCollectiveStore(db: SqlExecutor) {
  return {
    /**
     * Recalcule les agrégats sur tout le journal et remplace les précédents.
     * Le seuil d'anonymat ne descend jamais sous `COLLECTIVE_MIN_LEARNERS`.
     */
    async compute(
      now: Date,
      minLearners?: number,
    ): Promise<{ notions: number; minLearners: number }> {
      const k = effectiveMinLearners(minLearners);
      const insights = buildCollectiveInsights(await readRaw(db), k);
      await db.transaction(async (tx) => {
        // Données dérivées (pas le journal) : chaque calcul remplace le précédent.
        await tx.query("DELETE FROM collective_insights");
        // Date du calcul, gardée même si aucune notion n'atteint le seuil.
        await tx.query(
          `INSERT INTO settings (key, value) VALUES ($1, $2::jsonb)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
          [LAST_RUN_KEY, JSON.stringify(now.toISOString())],
        );
        for (const i of insights) {
          await tx.query(
            `INSERT INTO collective_insights (notion_id, computed_at, min_learners, learners, answers,
               success_rate, stuck_rate, avg_answers_to_success, avg_tutor_seconds, misconceptions, formats, exercises)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
              i.notionId,
              now.toISOString(),
              k,
              i.learners,
              i.answers,
              i.successRate,
              i.stuckRate,
              i.avgAnswersToSuccess,
              i.avgTutorSeconds,
              JSON.stringify(i.misconceptions),
              JSON.stringify(i.formats),
              JSON.stringify(i.exercises),
            ],
          );
        }
      });
      return { notions: insights.length, minLearners: k };
    },

    /** Agrégats publiés, filtrés par pays ou matière, notions les plus bloquantes d'abord. */
    async list(
      filter: { countryId?: string; subjectId?: string } = {},
    ): Promise<StoredNotionInsight[]> {
      const { rows } = await db.query<InsightRow>(
        `${SELECT_INSIGHTS}
         WHERE ($1::uuid IS NULL OR c.id = $1::uuid) AND ($2::uuid IS NULL OR s.id = $2::uuid)
         ORDER BY ci.stuck_rate DESC, ci.learners DESC`,
        [filter.countryId ?? null, filter.subjectId ?? null],
      );
      return rows.map(toInsight);
    },

    /** Agrégats de quelques notions (absentes : effectif sous le seuil, ou pas encore calculées). */
    async forNotions(
      notionIds: readonly string[],
    ): Promise<StoredNotionInsight[]> {
      if (notionIds.length === 0) return [];
      const { rows } = await db.query<InsightRow>(
        `${SELECT_INSIGHTS} WHERE ci.notion_id::text = ANY($1::text[])`,
        [notionIds],
      );
      return rows.map(toInsight);
    },

    /** Date du dernier calcul, s'il y en a eu un qui a publié au moins une notion. */
    async lastComputedAt(): Promise<Date | null> {
      const { rows } = await db.query<{ at: Date | null; run: unknown }>(
        `SELECT (SELECT max(computed_at) FROM collective_insights) AS at,
           (SELECT value FROM settings WHERE key = $1) AS run`,
        [LAST_RUN_KEY],
      );
      const run =
        typeof rows[0]?.run === "string" ? new Date(rows[0].run) : null;
      const at = rows[0]?.at ?? null;
      if (run && !Number.isNaN(run.getTime()))
        return at && at.getTime() > run.getTime() ? at : run;
      return at;
    },
  };
}

export type CollectiveStore = ReturnType<typeof createCollectiveStore>;
