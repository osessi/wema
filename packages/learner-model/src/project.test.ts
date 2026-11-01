import {
  asEventId,
  asLearnerId,
  asMisconceptionId,
  asNotionId,
  type LearningEvent,
} from "@wema/domain";
import { describe, expect, it } from "vitest";
import { notionStatus, projectLearnerModel } from "./index";

const learner = asLearnerId("1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d");
const other = asLearnerId("9f8e7d6c-5b4a-4c3d-8e2f-1a0b9c8d7e6f");
const pythagore = asNotionId("maths.pythagore");
let counter = 0;

function answer(
  at: string,
  correct: boolean,
  misconceptionId: string | null = null,
  learnerId = learner,
): LearningEvent {
  counter += 1;
  return {
    id: asEventId(
      `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`,
    ),
    learnerId,
    occurredAt: new Date(at),
    source: "app",
    payload: {
      type: "answer.submitted",
      notionId: pythagore,
      correct,
      hintsUsed: 0,
      misconceptionId:
        misconceptionId === null ? null : asMisconceptionId(misconceptionId),
      exerciseRef: null,
      response: null,
    },
  };
}

function project(events: LearningEvent[]) {
  const result = projectLearnerModel(learner, events);
  if (!result.ok) throw new Error(result.error.kind);
  return result.value;
}

describe("projectLearnerModel", () => {
  it("sans événement : modèle vide, notion non vue", () => {
    const model = project([]);
    expect(model.eventCount).toBe(0);
    expect(model.notions).toEqual({});
    expect(notionStatus(model, pythagore)).toBe("not_seen");
  });

  it("une bonne réponse : en cours ; une mauvaise : à travailler", () => {
    const good = project([answer("2026-10-01T18:00:00Z", true)]);
    expect(notionStatus(good, pythagore)).toBe("in_progress");
    expect(good.notions[pythagore]?.pKnown).toBeCloseTo(0.6, 6);
    const bad = project([answer("2026-10-01T18:00:00Z", false)]);
    expect(notionStatus(bad, pythagore)).toBe("needs_work");
  });

  describe("fausse maîtrise : la validation exige une reconfirmation à 72 h", () => {
    const sameSession = () => [
      answer("2026-10-01T18:00:00Z", true),
      answer("2026-10-01T18:05:00Z", true),
      answer("2026-10-01T18:10:00Z", true),
    ];

    it("3 bonnes réponses dans la même séance restent « en cours »", () => {
      const model = project(sameSession());
      expect(model.notions[pythagore]?.pKnown).toBeGreaterThanOrEqual(0.95);
      expect(notionStatus(model, pythagore)).toBe("in_progress");
    });

    it("une bonne réponse 72 h plus tard valide la notion", () => {
      const model = project([
        ...sameSession(),
        answer("2026-10-04T18:10:00Z", true),
      ]);
      expect(notionStatus(model, pythagore)).toBe("mastered");
    });

    it("une bonne réponse juste avant 72 h ne valide pas", () => {
      const model = project([
        ...sameSession(),
        answer("2026-10-03T18:09:00Z", true),
      ]);
      expect(notionStatus(model, pythagore)).toBe("in_progress");
    });
  });

  it("le résultat ne dépend pas de l'ordre de fourniture des événements", () => {
    const events = [
      answer("2026-10-01T18:00:00Z", false, "oublie-racine-finale"),
      answer("2026-10-01T18:05:00Z", true),
      answer("2026-10-02T18:00:00Z", true),
      answer("2026-10-06T18:00:00Z", true),
    ];
    expect(project([...events].reverse())).toEqual(project(events));
  });

  it("refuse un événement d'un autre élève", () => {
    const result = projectLearnerModel(learner, [
      answer("2026-10-01T18:00:00Z", true),
      answer("2026-10-01T18:05:00Z", true, null, other),
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("mixed_learners");
  });

  it("suit une idée fausse jusqu'à 2 bonnes réponses, puis sa réapparition", () => {
    const id = "change-de-cote-change-de-signe";
    const seen = answer("2026-10-01T18:00:00Z", false, id);
    const first = answer("2026-10-01T18:05:00Z", true);
    const second = answer("2026-10-01T18:10:00Z", true);
    const again = answer("2026-10-02T18:00:00Z", false, id);

    const state = (events: LearningEvent[]) =>
      project(events).notions[pythagore]?.misconceptions.find(
        (m) => m.misconceptionId === id,
      );

    expect(state([seen])).toMatchObject({ occurrences: 1, active: true });
    expect(state([seen, first])).toMatchObject({ active: true });
    expect(state([seen, first, second])).toMatchObject({ active: false });
    expect(state([seen, first, second, again])).toMatchObject({
      occurrences: 2,
      active: true,
    });
  });

  it("garde les preuves dans l'ordre chronologique", () => {
    const a = answer("2026-10-01T18:00:00Z", true);
    const b = answer("2026-10-02T18:00:00Z", false);
    expect(project([b, a]).notions[pythagore]?.evidence).toEqual([a.id, b.id]);
  });
});

describe("identifiant d'élève en majuscules", () => {
  it("projette normalement quand l'appelant fournit l'identifiant en majuscules", () => {
    const result = projectLearnerModel(asLearnerId(learner.toUpperCase()), [
      answer("2026-10-01T18:00:00Z", true),
    ]);
    expect(result.ok).toBe(true);
  });
});
