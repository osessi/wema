import {
  asEventId,
  asLearnerId,
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
const declare = (
  key:
    | "format.visual"
    | "format.scaffolded"
    | "confidence.low"
    | "confidence.high",
  value: boolean,
  source: "guardian" | "teacher" | "learner",
): LearningEventPayload => ({
  type: "preference.declared",
  key,
  label: null,
  value,
  source,
});

describe("projectHypotheses", () => {
  it("une déclaration ouvre une hypothèse avec sa source, sa confiance et sa preuve", () => {
    const e = event(declare("format.visual", true, "guardian"));
    expect(projectHypotheses([e]).hypotheses).toEqual([
      {
        key: "format.visual",
        statement: "Comprend mieux avec des schémas ou des dessins",
        sources: ["declared_guardian"],
        confidence: 0.5,
        status: "supported",
        evidence: [e.id],
      },
    ]);
  });

  it("deux sources d'accord se renforcent", () => {
    const h = projectHypotheses([
      event(declare("format.visual", true, "guardian")),
      event(declare("format.visual", true, "teacher"), 2),
    ]).hypotheses[0];
    expect(h).toMatchObject({ status: "supported", confidence: 0.65 });
  });

  it("l'élève qui dément le parent rend l'hypothèse incertaine, sans l'effacer", () => {
    const h = projectHypotheses([
      event(declare("format.scaffolded", true, "guardian")),
      event(declare("format.scaffolded", false, "learner"), 2),
    ]).hypotheses[0];
    expect(h).toMatchObject({
      status: "uncertain",
      sources: ["declared_guardian", "declared_learner"],
      confidence: 0.2,
    });
  });

  it("une même source garde son dernier avis", () => {
    const h = projectHypotheses([
      event(declare("format.visual", true, "teacher")),
      event(declare("format.visual", false, "teacher"), 2),
    ]).hypotheses[0];
    expect(h?.status).toBe("contradicted");
  });

  it("un centre d'intérêt de l'entretien a une confiance plafonnée ; un libellé de santé est écarté", () => {
    const intake = event({
      type: "intake.completed",
      sessionId: "s1",
      hypotheses: [
        { key: "interest", label: "Football", confidence: 0.9 },
        { key: "interest", label: "TDAH", confidence: 0.9 },
      ],
    });
    expect(projectHypotheses([intake]).hypotheses).toEqual([
      expect.objectContaining({
        key: "interest:football",
        sources: ["intake"],
        confidence: 0.35,
      }),
    ]);
  });

  it("« manque de confiance » et « a confiance » ne sont pas affirmés ensemble", () => {
    const list = projectHypotheses([
      event(declare("confidence.low", true, "guardian")),
      event(declare("confidence.high", true, "teacher"), 2),
    ]).hypotheses;
    expect(list.find((h) => h.key === "confidence.high")?.status).toBe(
      "supported",
    );
    expect(list.find((h) => h.key === "confidence.low")?.status).toBe(
      "uncertain",
    );
  });
});
