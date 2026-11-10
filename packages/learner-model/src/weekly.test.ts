import {
  asEventId,
  asLearnerId,
  asNotionId,
  type LearningEvent,
} from "@wema/domain";
import { describe, expect, it } from "vitest";
import { projectLearnerModel, weeklyActivity } from "./index";

const learner = asLearnerId("1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d");
const fractions = asNotionId("maths.fractions");
const pythagore = asNotionId("maths.pythagore");
const thales = asNotionId("maths.thales");
let counter = 0;

function answer(at: string, notionId = fractions, correct = true) {
  counter += 1;
  const event: LearningEvent = {
    id: asEventId(
      `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`,
    ),
    learnerId: learner,
    occurredAt: new Date(at),
    source: "app",
    payload: {
      type: "answer.submitted",
      notionId,
      correct,
      hintsUsed: 0,
      misconceptionId: null,
      exerciseRef: null,
      response: null,
      scaffolded: null,
      misconceptionSource: null,
      misconceptionConfidence: null,
    },
  };
  return event;
}

/** Série de bonnes réponses ; deux séries espacées de plus de 72 h confirment la maîtrise. */
function masteryRun(day: string, notionId: NotionIdLike) {
  return Array.from({ length: 12 }, (_, i) =>
    answer(`${day}T10:${String(i).padStart(2, "0")}:00Z`, notionId),
  );
}
type NotionIdLike = ReturnType<typeof asNotionId>;

const NOW = new Date("2026-11-10T18:00:00Z");

describe("weeklyActivity", () => {
  it("sans journal : sept jours vides, aucune activité", () => {
    const w = weeklyActivity(learner, [], NOW);
    expect(w.days).toHaveLength(7);
    expect(w.days[0]?.date).toBe("2026-11-04");
    expect(w.days[6]?.date).toBe("2026-11-10");
    expect(w.answers).toBe(0);
    expect(w.activeDays).toBe(0);
    expect(w.lastActivityAt).toBeNull();
    expect(w.validated).toEqual([]);
    expect(w.reworked).toEqual([]);
  });

  it("compte les réponses par jour et ignore ce qui précède la semaine", () => {
    const events = [
      answer("2026-10-20T09:00:00Z"),
      answer("2026-11-04T09:00:00Z"),
      answer("2026-11-10T08:00:00Z", fractions, false),
      answer("2026-11-10T09:00:00Z"),
    ];
    const w = weeklyActivity(learner, events, NOW);
    expect(w.days.map((d) => d.answers)).toEqual([1, 0, 0, 0, 0, 0, 2]);
    expect(w.answers).toBe(3);
    expect(w.correct).toBe(2);
    expect(w.activeDays).toBe(2);
    expect(w.lastActivityAt?.toISOString()).toBe("2026-11-10T09:00:00.000Z");
  });

  it("validée : maîtrisée maintenant et pas au début de la semaine ; reprise : travaillée sans être validée", () => {
    const events = [
      // Pythagore maîtrisée avant la semaine, revue cette semaine : reprise, pas validée.
      ...masteryRun("2026-10-01", pythagore),
      ...masteryRun("2026-10-05", pythagore),
      answer("2026-11-06T10:00:00Z", pythagore),
      // Fractions maîtrisée pendant la semaine : validée.
      ...masteryRun("2026-11-04", fractions),
      ...masteryRun("2026-11-08", fractions),
      // Thalès : une erreur cette semaine, reprise.
      answer("2026-11-09T10:00:00Z", thales, false),
    ];
    const model = projectLearnerModel(learner, events);
    expect(model.ok && model.value.notions[fractions]?.status).toBe("mastered");
    const w = weeklyActivity(learner, events, NOW);
    expect(w.validated).toEqual([fractions]);
    expect(w.reworked).toEqual([pythagore, thales].sort());
  });

  it("n'utilise pas d'événement daté après maintenant", () => {
    const w = weeklyActivity(learner, [answer("2026-11-11T09:00:00Z")], NOW);
    expect(w.answers).toBe(0);
    expect(w.lastActivityAt).toBeNull();
  });
});
