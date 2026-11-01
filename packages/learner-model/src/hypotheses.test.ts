import {
  asEventId,
  asLearnerId,
  asNotionId,
  type LearningEvent,
  type LearningEventPayload,
} from "@wema/domain";
import { describe, expect, it } from "vitest";
import { projectHypotheses } from "./index";

const learner = asLearnerId("1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d");
let n = 0;
const event = (payload: LearningEventPayload, day = 1): LearningEvent => ({
  id: asEventId(`00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`),
  learnerId: learner,
  occurredAt: new Date(`2026-10-${String(day).padStart(2, "0")}T10:00:00Z`),
  source: "web",
  payload,
});
const answer = (
  scaffolded: boolean,
  correct: boolean,
): LearningEventPayload => ({
  type: "answer.submitted",
  notionId: asNotionId("n"),
  correct,
  hintsUsed: 0,
  misconceptionId: null,
  exerciseRef: null,
  response: null,
  misconceptionSource: null,
  misconceptionConfidence: null,
  scaffolded,
});

describe("projectHypotheses", () => {
  it("une déclaration ouvre une hypothèse avec sa source, sa confiance et sa preuve", () => {
    const declared = event({
      type: "preference.declared",
      key: "format.visual",
      label: null,
      value: true,
      source: "guardian",
    });
    const [h] = projectHypotheses([declared]).hypotheses;
    expect(h).toEqual({
      key: "format.visual",
      statement: "Comprend mieux avec des schémas ou des dessins",
      sources: ["declared_guardian"],
      confidence: 0.5,
      status: "supported",
      evidence: [declared.id],
    });
  });

  it("un centre d'intérêt de l'entretien a une confiance plafonnée", () => {
    const intake = event({
      type: "intake.completed",
      sessionId: "s1",
      hypotheses: [{ key: "interest", label: "Football", confidence: 0.9 }],
    });
    expect(projectHypotheses([intake]).hypotheses[0]).toMatchObject({
      key: "interest:football",
      statement: "Centre d'intérêt : Football",
      sources: ["intake"],
      confidence: 0.35,
    });
  });

  it("la mesure confirme l'aide des étapes guidées quand l'écart est net", () => {
    const events = [
      ...[true, true, true, true].map((c) => event(answer(true, c))),
      ...[false, false, true, false].map((c) => event(answer(false, c))),
    ];
    expect(projectHypotheses(events).hypotheses[0]).toMatchObject({
      key: "format.scaffolded",
      sources: ["measured"],
      status: "supported",
      confidence: 0.9,
    });
  });

  it("la mesure contredit une déclaration démentie par les résultats", () => {
    const events = [
      event({
        type: "preference.declared",
        key: "format.scaffolded",
        label: null,
        value: true,
        source: "teacher",
      }),
      ...[false, false, true, false].map((c) => event(answer(true, c), 2)),
      ...[true, true, true, true].map((c) => event(answer(false, c), 2)),
    ];
    const h = projectHypotheses(events).hypotheses[0];
    expect(h?.status).toBe("contradicted");
    expect(h?.sources).toEqual(["declared_teacher", "measured"]);
  });

  it("pas de mesure avant assez de réponses de chaque côté", () => {
    const events = [event(answer(true, true)), event(answer(false, false))];
    expect(projectHypotheses(events).hypotheses).toEqual([]);
  });

  it("garde le dernier état d'un besoin déclaré, à part des hypothèses", () => {
    const events = [
      event(
        {
          type: "need.declared",
          need: "need.dyslexia",
          active: true,
          source: "guardian",
          consent: true,
        },
        1,
      ),
      event(
        {
          type: "need.declared",
          need: "need.dyslexia",
          active: false,
          source: "guardian",
          consent: true,
        },
        2,
      ),
    ];
    const profile = projectHypotheses(events);
    expect(profile.hypotheses).toEqual([]);
    expect(profile.needs).toEqual([
      expect.objectContaining({ need: "need.dyslexia", active: false }),
    ]);
  });
});
