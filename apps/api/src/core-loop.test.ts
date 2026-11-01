import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { loadCurriculumSeed } from "@wema/curriculum";
import { createEventStore, fromPglite, migrate } from "@wema/db";
import {
  asEventId,
  asLearnerId,
  type LearningEvent,
  type MisconceptionId,
  type NotionId,
} from "@wema/domain";
import { notionStatus, projectLearnerModel } from "@wema/learner-model";
import { expect, it } from "vitest";

const contentDir = fileURLToPath(
  new URL("../../../content/curriculum", import.meta.url),
);
const learner = asLearnerId("1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d");

function answer(
  pythagore: NotionId,
  forgotRoot: MisconceptionId,
  n: number,
  at: string,
  correct: boolean,
  withMisconception = false,
): LearningEvent {
  return {
    id: asEventId(`00000000-0000-4000-8000-${String(n).padStart(12, "0")}`),
    learnerId: learner,
    occurredAt: new Date(at),
    source: "app",
    payload: {
      type: "answer.submitted",
      notionId: pythagore,
      correct,
      hintsUsed: 0,
      misconceptionId: withMisconception ? forgotRoot : null,
      exerciseRef: null,
    },
  };
}

it("un élève progresse sur Pythagore et une idée fausse est suivie", async () => {
  const seed = await loadCurriculumSeed(contentDir);
  if (!seed.ok) throw new Error(JSON.stringify(seed.error));
  const france = seed.value.find((c) => c.country.code === "FR");
  const notion = france?.notions.find((n) => n.code === "pythagore");
  const misconception = notion?.misconceptions.find((m) =>
    m.description.includes("racine carrée"),
  );
  const other = france?.notions.find((n) => n.code === "equations-1er-degre");
  if (!notion || !misconception || !other) {
    throw new Error("jeu d'exemple incomplet");
  }
  const pythagore = notion.id;
  const forgotRoot = misconception.id;
  const at = (n: number, date: string, correct: boolean, m = false) =>
    answer(pythagore, forgotRoot, n, date, correct, m);

  const db = fromPglite(new PGlite());
  await migrate(db);
  const store = createEventStore(db);
  for (const event of [
    at(1, "2026-10-01T18:00:00Z", false, true),
    at(2, "2026-10-01T18:05:00Z", true),
    at(3, "2026-10-01T18:10:00Z", true),
    at(4, "2026-10-01T18:15:00Z", true),
    at(5, "2026-10-05T18:00:00Z", true),
  ]) {
    expect((await store.append(event)).ok).toBe(true);
  }

  const model = projectLearnerModel(
    learner,
    await store.listByLearner(learner),
  );
  if (!model.ok) throw new Error(model.error.kind);

  expect(notionStatus(model.value, pythagore)).toBe("mastered");
  expect(
    model.value.notions[pythagore]?.misconceptions.find(
      (m) => m.misconceptionId === forgotRoot,
    ),
  ).toMatchObject({ occurrences: 1, active: false });
  expect(notionStatus(model.value, other.id)).toBe("not_seen");
});
