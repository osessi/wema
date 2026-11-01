import {
  asEventId,
  asLearnerId,
  asNotionId,
  type LearningEvent,
} from "@wema/domain";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  notionStatus,
  parseLearnerModelSettings,
  projectLearnerModel,
} from "./index";

describe("parseLearnerModelSettings", () => {
  it("accepte les réglages par défaut", () => {
    expect(parseLearnerModelSettings(DEFAULT_SETTINGS)).toEqual({
      ok: true,
      value: DEFAULT_SETTINGS,
    });
  });

  it("refuse un seuil « En cours » au-dessus du seuil « Validé »", () => {
    const result = parseLearnerModelSettings({
      ...DEFAULT_SETTINGS,
      inProgressThreshold: 0.97,
    });
    if (result.ok) throw new Error("une erreur était attendue");
    expect(result.error.issues[0]?.path).toBe("inProgressThreshold");
  });

  it("refuse une probabilité hors de ]0, 1[ et un délai négatif", () => {
    const result = parseLearnerModelSettings({
      ...DEFAULT_SETTINGS,
      bkt: { ...DEFAULT_SETTINGS.bkt, pLearn: 1 },
      reconfirmDelayHours: -1,
    });
    if (result.ok) throw new Error("une erreur était attendue");
    expect(result.error.issues.map((i) => i.path).sort()).toEqual([
      "bkt.pLearn",
      "reconfirmDelayHours",
    ]);
  });
});

describe("projectLearnerModel avec des réglages modifiés", () => {
  const learner = asLearnerId("1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d");
  const notion = asNotionId("maths.pythagore");
  const answer = (n: number, at: string): LearningEvent => ({
    id: asEventId(`00000000-0000-4000-8000-${String(n).padStart(12, "0")}`),
    learnerId: learner,
    occurredAt: new Date(at),
    source: "app",
    payload: {
      type: "answer.submitted",
      notionId: notion,
      correct: true,
      hintsUsed: 0,
      misconceptionId: null,
      exerciseRef: null,
    },
  });
  const events = [
    answer(1, "2026-10-01T18:00:00Z"),
    answer(2, "2026-10-01T18:05:00Z"),
    answer(3, "2026-10-01T18:10:00Z"),
    answer(4, "2026-10-02T18:00:00Z"),
  ];

  it("avec 72 h, une reconfirmation le lendemain ne suffit pas", () => {
    const model = projectLearnerModel(learner, events);
    if (!model.ok) throw new Error(model.error.kind);
    expect(notionStatus(model.value, notion)).toBe("in_progress");
  });

  it("avec un délai réglé à 12 h, la même reconfirmation valide la notion", () => {
    const model = projectLearnerModel(learner, events, {
      ...DEFAULT_SETTINGS,
      reconfirmDelayHours: 12,
    });
    if (!model.ok) throw new Error(model.error.kind);
    expect(notionStatus(model.value, notion)).toBe("mastered");
  });
});
