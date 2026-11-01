import { randomUUID } from "node:crypto";
import type {
  CanonicalAnswer,
  ExerciseIntent,
  ExerciseIntentId,
  ExerciseSource,
  ExerciseStatus,
  ExerciseVariant,
  ExerciseVariantId,
  LearnerId,
  NotionId,
  OrganizationId,
  RenderedMath,
  Result,
  UserId,
  VariantPlan,
} from "@wema/domain";
import {
  asExerciseIntentId,
  asExerciseVariantId,
  asLearnerId,
  asMisconceptionId,
  asNotionId,
  asOrganizationId,
  asUserId,
  canonicalAnswerSchema,
  err,
  exerciseTaskSchema,
  ok,
  parameterSpecSchema,
} from "@wema/domain";
import { z } from "zod";
import type { SqlExecutor } from "./executor";

/** Contenu modifiable d'une intention (tout changement la repasse en brouillon). */
export type IntentContent = Pick<
  ExerciseIntent,
  | "notionId"
  | "objective"
  | "misconceptionId"
  | "statement"
  | "task"
  | "parameters"
  | "constraints"
  | "steps"
  | "expected"
>;

export type ExerciseWriteError =
  | { kind: "not_found" }
  | { kind: "invalid_reference"; constraint: string };

export interface BankEntry {
  id: string;
  organizationId: OrganizationId;
  notionId: NotionId;
  /** Lundi de la semaine, AAAA-MM-JJ. */
  week: string;
  intentId: ExerciseIntentId;
  status: "proposed" | "selected" | "rejected";
}

interface IntentRow {
  id: string;
  organization_id: string;
  notion_id: string;
  objective: string;
  misconception_id: string | null;
  statement: string;
  task: unknown;
  parameters: unknown;
  constraints: unknown;
  steps: unknown;
  expected: string | null;
  status: ExerciseStatus;
  source: ExerciseSource;
  created_by: string | null;
  version: number;
}
const INTENT_COLUMNS =
  "id, organization_id, notion_id, objective, misconception_id, statement, task, parameters, constraints, steps, expected, status, source, created_by, version";

const strings = z.array(z.string());

/** Les colonnes JSON ont été validées à l'écriture ; une ligne illisible est un bug. */
function toIntent(r: IntentRow): ExerciseIntent {
  return {
    id: asExerciseIntentId(r.id),
    organizationId: asOrganizationId(r.organization_id),
    notionId: asNotionId(r.notion_id),
    objective: r.objective,
    misconceptionId:
      r.misconception_id === null
        ? null
        : asMisconceptionId(r.misconception_id),
    statement: r.statement,
    task: exerciseTaskSchema.parse(r.task),
    parameters: z.array(parameterSpecSchema).parse(r.parameters),
    constraints: strings.parse(r.constraints),
    steps: strings.parse(r.steps),
    expected: r.expected,
    status: r.status,
    source: r.source,
    createdBy: r.created_by === null ? null : asUserId(r.created_by),
    version: r.version,
  };
}

interface VariantRow {
  id: string;
  intent_id: string;
  learner_id: string | null;
  seed: string | number;
  level: number;
  scaffolded: boolean;
  hint_level: number;
  parameters: unknown;
  statement: string;
  rendered: unknown;
  steps: unknown;
  answer: unknown;
  verified_at: Date;
}
const VARIANT_COLUMNS =
  "id, intent_id, learner_id, seed, level, scaffolded, hint_level, parameters, statement, rendered, steps, answer, verified_at";

const levelSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
const hintSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
]);
const renderedSchema = z.record(
  z.string(),
  z.object({ text: z.string(), latex: z.string() }),
);

function toVariant(r: VariantRow): ExerciseVariant {
  return {
    id: asExerciseVariantId(r.id),
    intentId: asExerciseIntentId(r.intent_id),
    learnerId: r.learner_id === null ? null : asLearnerId(r.learner_id),
    seed: Number(r.seed),
    level: levelSchema.parse(r.level),
    scaffolded: r.scaffolded,
    hintLevel: hintSchema.parse(r.hint_level),
    parameters: z.record(z.string(), z.number()).parse(r.parameters),
    statement: r.statement,
    rendered: renderedSchema.parse(r.rendered),
    steps: strings.parse(r.steps),
    answer: canonicalAnswerSchema.parse(r.answer),
    verifiedAt: r.verified_at,
  };
}

function pgCode(e: unknown): { code: string; constraint: string } | null {
  if (
    typeof e !== "object" ||
    e === null ||
    !("code" in e) ||
    typeof e.code !== "string"
  )
    return null;
  return {
    code: e.code,
    constraint:
      "constraint" in e && typeof e.constraint === "string" ? e.constraint : "",
  };
}

async function guarded<T>(
  fn: () => Promise<T | null>,
): Promise<Result<T, ExerciseWriteError>> {
  try {
    const value = await fn();
    return value === null ? err({ kind: "not_found" }) : ok(value);
  } catch (e) {
    const pg = pgCode(e);
    if (pg?.code === "23503")
      return err({ kind: "invalid_reference", constraint: pg.constraint });
    throw e;
  }
}

const contentParams = (c: IntentContent) => [
  c.notionId,
  c.objective,
  c.misconceptionId,
  c.statement,
  JSON.stringify(c.task),
  JSON.stringify(c.parameters),
  JSON.stringify(c.constraints),
  JSON.stringify(c.steps),
  c.expected,
];

export function createExerciseStore(db: SqlExecutor) {
  const getIntent = async (
    id: ExerciseIntentId,
  ): Promise<ExerciseIntent | null> => {
    const { rows } = await db.query<IntentRow>(
      `SELECT ${INTENT_COLUMNS} FROM exercise_intents WHERE id = $1`,
      [id],
    );
    return rows[0] ? toIntent(rows[0]) : null;
  };

  return {
    getIntent,

    /** Intentions des organisations données (la sienne et la bibliothèque Wema). */
    async listIntents(input: {
      organizationIds: readonly OrganizationId[];
      notionId?: NotionId;
      status?: ExerciseStatus;
    }): Promise<ExerciseIntent[]> {
      const { rows } = await db.query<IntentRow>(
        `SELECT ${INTENT_COLUMNS} FROM exercise_intents
         WHERE organization_id = ANY($1::uuid[])
           AND ($2::uuid IS NULL OR notion_id = $2)
           AND ($3::text IS NULL OR status = $3)
         ORDER BY created_at DESC LIMIT 500`,
        [
          [...input.organizationIds],
          input.notionId ?? null,
          input.status ?? null,
        ],
      );
      return rows.map(toIntent);
    },

    createIntent: (
      input: IntentContent & {
        organizationId: OrganizationId;
        source: ExerciseSource;
        createdBy: UserId | null;
      },
    ) =>
      guarded(async () => {
        const { rows } = await db.query<IntentRow>(
          `INSERT INTO exercise_intents
             (id, notion_id, objective, misconception_id, statement, task, parameters, constraints, steps, expected,
              organization_id, source, created_by)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10, $11, $12, $13)
           RETURNING ${INTENT_COLUMNS}`,
          [
            randomUUID(),
            ...contentParams(input),
            input.organizationId,
            input.source,
            input.createdBy,
          ],
        );
        return rows[0] ? toIntent(rows[0]) : null;
      }),

    /** Modifier le contenu repasse l'intention en brouillon : il faudra la revalider. */
    updateIntent: (id: ExerciseIntentId, content: IntentContent) =>
      guarded(async () => {
        const { rows } = await db.query<IntentRow>(
          `UPDATE exercise_intents SET notion_id = $2, objective = $3, misconception_id = $4, statement = $5,
             task = $6::jsonb, parameters = $7::jsonb, constraints = $8::jsonb, steps = $9::jsonb, expected = $10,
             status = 'draft', version = version + 1, updated_at = now()
           WHERE id = $1 RETURNING ${INTENT_COLUMNS}`,
          [id, ...contentParams(content)],
        );
        return rows[0] ? toIntent(rows[0]) : null;
      }),

    /**
     * Valide l'intention seulement si elle n'a pas changé depuis la lecture
     * qui a servi à la vérifier ; sinon renvoie `not_found` (contenu modifié).
     */
    markValidated: (intent: Pick<ExerciseIntent, "id" | "version">) =>
      guarded(async () => {
        const { rows } = await db.query<IntentRow>(
          `UPDATE exercise_intents SET status = 'validated'
           WHERE id = $1 AND version = $2 AND status = 'draft' RETURNING ${INTENT_COLUMNS}`,
          [intent.id, intent.version],
        );
        return rows[0] ? toIntent(rows[0]) : null;
      }),

    /** Enregistre un essai d'élève sur une variante et renvoie le nombre d'essais, celui-ci compris. */
    async recordAttempt(input: {
      variantId: ExerciseVariantId;
      learnerId: LearnerId;
      correct: boolean;
    }): Promise<number> {
      return db.transaction(async (tx) => {
        // Sérialise les essais simultanés sur une même variante.
        await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
          `attempt:${input.variantId}`,
        ]);
        await tx.query(
          "INSERT INTO exercise_attempts (id, variant_id, learner_id, correct) VALUES ($1, $2, $3, $4)",
          [randomUUID(), input.variantId, input.learnerId, input.correct],
        );
        const { rows } = await tx.query<{ n: number }>(
          "SELECT count(*)::int AS n FROM exercise_attempts WHERE variant_id = $1 AND learner_id = $2",
          [input.variantId, input.learnerId],
        );
        return rows[0]?.n ?? 0;
      });
    },

    async countAttempts(
      variantId: ExerciseVariantId,
      learnerId: LearnerId,
    ): Promise<number> {
      const { rows } = await db.query<{ n: number }>(
        "SELECT count(*)::int AS n FROM exercise_attempts WHERE variant_id = $1 AND learner_id = $2",
        [variantId, learnerId],
      );
      return rows[0]?.n ?? 0;
    },

    setIntentStatus: (id: ExerciseIntentId, status: ExerciseStatus) =>
      guarded(async () => {
        const { rows } = await db.query<IntentRow>(
          `UPDATE exercise_intents SET status = $2, updated_at = now() WHERE id = $1 RETURNING ${INTENT_COLUMNS}`,
          [id, status],
        );
        return rows[0] ? toIntent(rows[0]) : null;
      }),

    /** Enregistre une variante déjà vérifiée par services/math. */
    async createVariant(input: {
      intentId: ExerciseIntentId;
      learnerId: LearnerId | null;
      seed: number;
      plan: VariantPlan;
      parameters: Readonly<Record<string, number>>;
      statement: string;
      rendered: Readonly<Record<string, RenderedMath>>;
      steps: readonly string[];
      answer: CanonicalAnswer;
      verifiedAt: Date;
    }): Promise<ExerciseVariant> {
      const { rows } = await db.query<VariantRow>(
        `INSERT INTO exercise_variants
           (id, intent_id, learner_id, seed, level, scaffolded, hint_level, parameters, statement, rendered, steps,
            answer, verified_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10::jsonb, $11::jsonb, $12::jsonb, $13)
         RETURNING ${VARIANT_COLUMNS}`,
        [
          randomUUID(),
          input.intentId,
          input.learnerId,
          input.seed,
          input.plan.level,
          input.plan.scaffolded,
          input.plan.hintLevel,
          JSON.stringify(input.parameters),
          input.statement,
          JSON.stringify(input.rendered),
          JSON.stringify(input.steps),
          JSON.stringify(input.answer),
          input.verifiedAt.toISOString(),
        ],
      );
      const row = rows[0];
      if (!row) throw new Error("création de variante sans retour");
      return toVariant(row);
    },

    async getVariant(id: ExerciseVariantId): Promise<ExerciseVariant | null> {
      const { rows } = await db.query<VariantRow>(
        `SELECT ${VARIANT_COLUMNS} FROM exercise_variants WHERE id = $1`,
        [id],
      );
      return rows[0] ? toVariant(rows[0]) : null;
    },

    async listVariantsForLearner(
      learnerId: LearnerId,
    ): Promise<ExerciseVariant[]> {
      const { rows } = await db.query<VariantRow>(
        `SELECT ${VARIANT_COLUMNS} FROM exercise_variants WHERE learner_id = $1 ORDER BY created_at DESC LIMIT 200`,
        [learnerId],
      );
      return rows.map(toVariant);
    },

    async listBank(input: {
      organizationId: OrganizationId;
      week: string;
      notionId?: NotionId;
    }): Promise<BankEntry[]> {
      const { rows } = await db.query<{
        id: string;
        organization_id: string;
        notion_id: string;
        week: string;
        intent_id: string;
        status: BankEntry["status"];
      }>(
        `SELECT id, organization_id, notion_id, to_char(week, 'YYYY-MM-DD') AS week, intent_id, status
         FROM exercise_bank_entries
         WHERE organization_id = $1 AND week = $2::date AND ($3::uuid IS NULL OR notion_id = $3)
         ORDER BY created_at`,
        [input.organizationId, input.week, input.notionId ?? null],
      );
      return rows.map((r) => ({
        id: r.id,
        organizationId: asOrganizationId(r.organization_id),
        notionId: asNotionId(r.notion_id),
        week: r.week,
        intentId: asExerciseIntentId(r.intent_id),
        status: r.status,
      }));
    },

    /** Propose une intention pour la semaine ; la reproposer ne crée pas de doublon. */
    proposeForWeek: (input: {
      organizationId: OrganizationId;
      week: string;
      intent: ExerciseIntent;
      proposedBy: UserId | null;
    }) =>
      guarded(async () => {
        const { rows } = await db.query<{ id: string }>(
          `INSERT INTO exercise_bank_entries (id, organization_id, notion_id, week, intent_id, proposed_by)
           VALUES ($1, $2, $3, $4::date, $5, $6)
           ON CONFLICT (organization_id, week, intent_id) DO UPDATE SET organization_id = EXCLUDED.organization_id
           RETURNING id`,
          [
            randomUUID(),
            input.organizationId,
            input.intent.notionId,
            input.week,
            input.intent.id,
            input.proposedBy,
          ],
        );
        return rows[0]?.id ?? null;
      }),

    decideBankEntry: (input: {
      id: string;
      organizationId: OrganizationId;
      status: "selected" | "rejected";
      decidedBy: UserId;
    }) =>
      guarded(async () => {
        const { rows } = await db.query<{ id: string }>(
          `UPDATE exercise_bank_entries SET status = $3, decided_by = $4, decided_at = now()
           WHERE id = $1 AND organization_id = $2 RETURNING id`,
          [input.id, input.organizationId, input.status, input.decidedBy],
        );
        return rows[0]?.id ?? null;
      }),
  };
}

export type ExerciseStore = ReturnType<typeof createExerciseStore>;
