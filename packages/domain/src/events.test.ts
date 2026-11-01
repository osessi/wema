import { describe, expect, it } from "vitest";
import { parseLearningEvent } from "./index";

const valid = {
  id: "8f1d2c3a-4b5e-4f60-8a7b-9c0d1e2f3a4b",
  learnerId: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
  occurredAt: "2026-10-01T18:05:00Z",
  source: "app",
  payload: {
    type: "answer.submitted",
    notionId: "maths.pythagore",
    correct: false,
    hintsUsed: 1,
    misconceptionId: "oublie-racine-finale",
    exerciseRef: null,
    response: null,
    scaffolded: null,
    misconceptionSource: null,
    misconceptionConfidence: null,
  },
};

describe("parseLearningEvent", () => {
  it("accepte un événement valide et convertit la date ISO en Date", () => {
    const result = parseLearningEvent(valid);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.occurredAt).toEqual(new Date("2026-10-01T18:05:00Z"));
    }
  });

  it("refuse un nombre d'indices négatif", () => {
    const result = parseLearningEvent({
      ...valid,
      payload: { ...valid.payload, hintsUsed: -1 },
    });
    expect(result.ok).toBe(false);
  });

  it("refuse un identifiant d'élève qui n'est pas un UUID", () => {
    const result = parseLearningEvent({ ...valid, learnerId: "yanis" });
    expect(result.ok).toBe(false);
  });

  it("refuse un type d'événement inconnu", () => {
    const result = parseLearningEvent({
      ...valid,
      payload: { ...valid.payload, type: "inconnu" },
    });
    expect(result.ok).toBe(false);
  });
});

describe("normalisation des identifiants", () => {
  it("met les UUID en minuscules, comme Postgres les renvoie", () => {
    const result = parseLearningEvent({
      ...valid,
      id: valid.id.toUpperCase(),
      learnerId: valid.learnerId.toUpperCase(),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.id).toBe(valid.id);
      expect(result.value.learnerId).toBe(valid.learnerId);
    }
  });
});

describe("événements du profil", () => {
  it("relit une préférence déclarée et refuse un besoin sans consentement", () => {
    const base = {
      id: "8f1d2c3a-4b5e-4f60-8a7b-9c0d1e2f3a4c",
      learnerId: valid.learnerId,
      occurredAt: valid.occurredAt,
      source: "web",
    };
    expect(
      parseLearningEvent({
        ...base,
        payload: {
          type: "preference.declared",
          key: "interest",
          label: "Football",
          value: true,
          source: "learner",
        },
      }).ok,
    ).toBe(true);
    expect(
      parseLearningEvent({
        ...base,
        payload: {
          type: "preference.declared",
          key: "inventee",
          label: null,
          value: true,
          source: "learner",
        },
      }).ok,
    ).toBe(false);
  });
});
