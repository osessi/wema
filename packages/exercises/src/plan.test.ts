import { asEventId, asMisconceptionId, asNotionId } from "@wema/domain";
import type { NotionState } from "@wema/learner-model";
import { describe, expect, it } from "vitest";
import { planVariant } from "./index";

const misconception = asMisconceptionId("m-signe");
const state = (
  pKnown: number,
  observations = 2,
  active = false,
): NotionState => ({
  notionId: asNotionId("n"),
  pKnown,
  observations,
  status: "in_progress",
  masteryCandidateAt: null,
  evidence: [asEventId("e1")],
  misconceptions: active
    ? [
        {
          misconceptionId: misconception,
          occurrences: 1,
          lastSeenAt: new Date(),
          active: true,
          evidence: [],
        },
      ]
    : [],
});

describe("planVariant", () => {
  const intent = { misconceptionId: null };

  it("notion jamais vue : nombres simples, étapes guidées, un indice", () => {
    expect(planVariant(intent, undefined)).toEqual({
      level: 1,
      scaffolded: true,
      hintLevel: 1,
    });
  });

  it("maîtrise basse : plus d'indices quand l'élève bute depuis plusieurs réponses", () => {
    expect(planVariant(intent, state(0.3, 1))).toEqual({
      level: 1,
      scaffolded: true,
      hintLevel: 1,
    });
    expect(planVariant(intent, state(0.3, 4))).toEqual({
      level: 1,
      scaffolded: true,
      hintLevel: 2,
    });
  });

  it("en cours : niveau intermédiaire sans guidage ; proche de la validation : plus exigeant, sans indice", () => {
    expect(planVariant(intent, state(0.7))).toEqual({
      level: 2,
      scaffolded: false,
      hintLevel: 1,
    });
    expect(planVariant(intent, state(0.97))).toEqual({
      level: 3,
      scaffolded: false,
      hintLevel: 0,
    });
  });

  it("guide par étapes un exercice qui cible une idée fausse encore active", () => {
    const targeted = { misconceptionId: misconception };
    expect(planVariant(targeted, state(0.7, 3, true))).toEqual({
      level: 2,
      scaffolded: true,
      hintLevel: 1,
    });
    expect(planVariant(targeted, state(0.7, 3, false)).scaffolded).toBe(false);
  });

  it("suit les seuils réglés dans le back-office", () => {
    const settings = {
      bkt: { pInit: 0.2, pLearn: 0.15, pSlip: 0.1, pGuess: 0.2 },
      inProgressThreshold: 0.8,
      masteryThreshold: 0.9,
      reconfirmDelayHours: 72,
      misconceptionClearingStreak: 2,
    };
    expect(planVariant(intent, state(0.7), settings).level).toBe(1);
  });
});
