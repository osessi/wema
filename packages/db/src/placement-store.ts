import { randomUUID } from "node:crypto";
import type {
  CanonicalAnswer,
  ExerciseIntentId,
  LearnerId,
  NotionId,
  ProgramId,
  RenderedMath,
  SubjectId,
} from "@wema/domain";
import {
  asExerciseIntentId,
  asNotionId,
  asProgramId,
  asSubjectId,
  canonicalAnswerSchema,
} from "@wema/domain";
import { z } from "zod";
import type { SqlExecutor } from "./executor";

/** Test de niveau d'un élève dans une matière (migration 0029). */
export interface PlacementTest {
  id: string;
  learnerId: LearnerId;
  subjectId: SubjectId;
  programId: ProgramId;
  startedAt: Date;
  completedAt: Date | null;
  skippedNotions: NotionId[];
}

/** Question du test ; la réponse attendue ne quitte jamais le serveur. */
export interface PlacementItem {
  id: string;
  testId: string;
  position: number;
  notionId: NotionId;
  intentId: ExerciseIntentId;
  statement: string;
  rendered: Record<string, RenderedMath>;
  answer: CanonicalAnswer;
  answeredAt: Date | null;
  response: string | null;
  correct: boolean | null;
  eventId: string | null;
}

interface TestRow {
  id: string;
  learner_id: string;
  subject_id: string;
  program_id: string;
  started_at: Date;
  completed_at: Date | null;
  skipped_notions: string[];
}

interface ItemRow {
  id: string;
  test_id: string;
  position: number;
  notion_id: string;
  intent_id: string;
  statement: string;
  rendered: unknown;
  answer: unknown;
  answered_at: Date | null;
  response: string | null;
  correct: boolean | null;
  event_id: string | null;
}

const renderedSchema = z.record(
  z.string(),
  z.object({ text: z.string(), latex: z.string() }),
);

const toTest = (r: TestRow, learnerId: LearnerId): PlacementTest => ({
  id: r.id,
  learnerId,
  subjectId: asSubjectId(r.subject_id),
  programId: asProgramId(r.program_id),
  startedAt: r.started_at,
  completedAt: r.completed_at,
  skippedNotions: r.skipped_notions.map(asNotionId),
});

const toItem = (r: ItemRow): PlacementItem => ({
  id: r.id,
  testId: r.test_id,
  position: r.position,
  notionId: asNotionId(r.notion_id),
  intentId: asExerciseIntentId(r.intent_id),
  statement: r.statement,
  rendered: renderedSchema.parse(r.rendered),
  answer: canonicalAnswerSchema.parse(r.answer),
  answeredAt: r.answered_at,
  response: r.response,
  correct: r.correct,
  eventId: r.event_id,
});

const TEST_COLUMNS =
  "id, learner_id, subject_id, program_id, started_at, completed_at, skipped_notions::text[] AS skipped_notions";

export function createPlacementStore(db: SqlExecutor) {
  return {
    /** Tests d'un élève, le plus récent d'abord (toutes matières, ou une seule). */
    async list(
      learnerId: LearnerId,
      subjectId?: SubjectId,
    ): Promise<PlacementTest[]> {
      const { rows } = await db.query<TestRow>(
        `SELECT ${TEST_COLUMNS} FROM placement_tests
         WHERE learner_id = $1 AND ($2::uuid IS NULL OR subject_id = $2)
         ORDER BY started_at DESC, id`,
        [learnerId, subjectId ?? null],
      );
      return rows.map((r) => toTest(r, learnerId));
    },

    /** Ouvre un test, ou renvoie celui déjà en cours dans la matière. */
    async open(input: {
      learnerId: LearnerId;
      subjectId: SubjectId;
      programId: ProgramId;
      now: Date;
    }): Promise<PlacementTest> {
      await db.query(
        `INSERT INTO placement_tests (id, learner_id, subject_id, program_id, started_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (learner_id, subject_id) WHERE completed_at IS NULL DO NOTHING`,
        [
          randomUUID(),
          input.learnerId,
          input.subjectId,
          input.programId,
          input.now.toISOString(),
        ],
      );
      const { rows } = await db.query<TestRow>(
        `SELECT ${TEST_COLUMNS} FROM placement_tests
         WHERE learner_id = $1 AND subject_id = $2 AND completed_at IS NULL`,
        [input.learnerId, input.subjectId],
      );
      const row = rows[0];
      if (!row) throw new Error("test de niveau introuvable après création");
      return toTest(row, input.learnerId);
    },

    async items(testId: string): Promise<PlacementItem[]> {
      const { rows } = await db.query<ItemRow>(
        "SELECT * FROM placement_items WHERE test_id = $1 ORDER BY position",
        [testId],
      );
      return rows.map(toItem);
    },

    async addItem(input: {
      testId: string;
      position: number;
      notionId: NotionId;
      intentId: ExerciseIntentId;
      statement: string;
      rendered: Readonly<Record<string, RenderedMath>>;
      answer: CanonicalAnswer;
    }): Promise<PlacementItem> {
      const { rows } = await db.query<ItemRow>(
        `INSERT INTO placement_items (id, test_id, position, notion_id, intent_id, statement, rendered, answer)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb) RETURNING *`,
        [
          randomUUID(),
          input.testId,
          input.position,
          input.notionId,
          input.intentId,
          input.statement,
          JSON.stringify(input.rendered),
          JSON.stringify(input.answer),
        ],
      );
      const row = rows[0];
      if (!row) throw new Error("question du test non créée");
      return toItem(row);
    },

    /** Enregistre la réponse ; faux si la question avait déjà une réponse. */
    async answer(input: {
      itemId: string;
      response: string | null;
      correct: boolean;
      eventId: string;
      at: Date;
    }): Promise<boolean> {
      const { rows } = await db.query(
        `UPDATE placement_items SET answered_at = $2, response = $3, correct = $4, event_id = $5
         WHERE id = $1 AND answered_at IS NULL RETURNING id`,
        [
          input.itemId,
          input.at.toISOString(),
          input.response,
          input.correct,
          input.eventId,
        ],
      );
      return rows.length > 0;
    },

    async skipNotion(testId: string, notionId: NotionId): Promise<void> {
      await db.query(
        `UPDATE placement_tests SET skipped_notions = array_append(skipped_notions, $2::uuid)
         WHERE id = $1 AND NOT ($2::uuid = ANY (skipped_notions))`,
        [testId, notionId],
      );
    },

    async complete(testId: string, at: Date): Promise<void> {
      await db.query(
        "UPDATE placement_tests SET completed_at = $2 WHERE id = $1 AND completed_at IS NULL",
        [testId, at.toISOString()],
      );
    },
  };
}

export type PlacementStore = ReturnType<typeof createPlacementStore>;
