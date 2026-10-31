import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { loadCurriculum } from "@wema/curriculum";
import { createEventStore, fromPglite, migrate } from "@wema/db";
import {
  asEventId,
  asLearnerId,
  asMisconceptionId,
  asNotionId,
  type LearningEvent,
} from "@wema/domain";
import { notionStatus, projectLearnerModel } from "@wema/learner-model";
import { expect, it } from "vitest";

const contentDir = fileURLToPath(
  new URL("../../../content/curriculum", import.meta.url),
);
const learner = asLearnerId("1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d");
const pythagore = asNotionId("maths.pythagore");
const forgotRoot = asMisconceptionId("oublie-racine-finale");

function answer(
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
  const curriculum = await loadCurriculum(contentDir);
  if (!curriculum.ok) throw new Error(JSON.stringify(curriculum.error));
  const misconceptionIds = curriculum.value
    .getNotion(pythagore)
    ?.misconceptions.map((m) => m.id);
  expect(misconceptionIds).toContain(forgotRoot);

  const db = fromPglite(new PGlite());
  await migrate(db);
  const store = createEventStore(db);
  for (const event of [
    answer(1, "2026-10-01T18:00:00Z", false, true),
    answer(2, "2026-10-01T18:05:00Z", true),
    answer(3, "2026-10-01T18:10:00Z", true),
    answer(4, "2026-10-01T18:15:00Z", true),
    answer(5, "2026-10-05T18:00:00Z", true),
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
  expect(
    notionStatus(model.value, asNotionId("maths.equations-1er-degre")),
  ).toBe("not_seen");
});
