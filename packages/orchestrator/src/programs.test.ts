import { asLearnerId, asNotionId, asSubjectId } from "@wema/domain";
import { projectLearnerModel } from "@wema/learner-model";
import { describe, expect, it } from "vitest";
import {
  choosePersonalPractice,
  effectivePrograms,
  type NextAction,
  nextActions,
} from "./index";

const maths = asSubjectId("maths");
const physics = asSubjectId("physique");

describe("programmes suivis par un élève", () => {
  it("sans classe, le programme individuel choisi par le parent est suivi", () => {
    const programs = effectivePrograms([
      { id: "p-fr-4e-maths", subjectId: maths, source: "individual" as const },
    ]);
    expect(programs.map((p) => p.id)).toEqual(["p-fr-4e-maths"]);
  });

  it("la classe reste prioritaire pour sa matière, le reste vient du parent", () => {
    const programs = effectivePrograms([
      { id: "indiv-maths", subjectId: maths, source: "individual" as const },
      {
        id: "indiv-physique",
        subjectId: physics,
        source: "individual" as const,
      },
      { id: "classe-maths", subjectId: maths, source: "class" as const },
    ]);
    expect(programs.map((p) => p.id)).toEqual([
      "classe-maths",
      "indiv-physique",
    ]);
  });

  it("deux classes de la même matière restent toutes les deux", () => {
    const programs = effectivePrograms([
      { id: "classe-a", subjectId: maths, source: "class" as const },
      { id: "classe-b", subjectId: maths, source: "class" as const },
    ]);
    expect(programs).toHaveLength(2);
  });

  it("le programme individuel donne la prochaine notion comme celui d'une classe", () => {
    const learner = asLearnerId("1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d");
    const model = projectLearnerModel(learner, []);
    if (!model.ok) throw new Error(model.error.kind);
    const first = asNotionId("carres");
    const actions = nextActions({
      model: model.value,
      events: [],
      prerequisites: new Map([[first, []]]),
      openVariants: [],
      programNotions: [first],
      now: new Date("2026-11-03T10:00:00Z"),
    });
    expect(actions[0]).toMatchObject({ kind: "start_notion", notionId: first });
  });
});

describe("exercice personnel d'un élève sans prof", () => {
  const a = asNotionId("notion-a");
  const b = asNotionId("notion-b");
  const start = (notionId: typeof a): NextAction => ({
    kind: "start_notion",
    notionId,
    reason: "",
    evidence: [],
  });
  const base = {
    used: new Map<string, number>(),
    allowedNotions: new Set<string>([a, b]),
  };

  it("prépare un exercice validé sur la première action utile", () => {
    expect(
      choosePersonalPractice({
        ...base,
        actions: [start(a)],
        intents: [{ id: "i1", notionId: a, misconceptionId: null }],
      }),
    ).toEqual({ intentId: "i1", notionId: a, kind: "start_notion" });
  });

  it("rien tant qu'un exercice ou un devoir attend une réponse", () => {
    expect(
      choosePersonalPractice({
        ...base,
        actions: [
          {
            kind: "finish_exercise",
            variantId: "v",
            notionId: a,
            reason: "",
            evidence: [],
          },
          start(b),
        ],
        intents: [{ id: "i1", notionId: b, misconceptionId: null }],
      }),
    ).toBeNull();
  });

  it("passe à l'action suivante quand la notion n'a pas d'exercice", () => {
    expect(
      choosePersonalPractice({
        ...base,
        actions: [
          { kind: "practice", notionId: a, reason: "", evidence: [] },
          start(b),
        ],
        intents: [{ id: "i2", notionId: b, misconceptionId: null }],
      })?.notionId,
    ).toBe(b);
  });

  it("jamais une notion d'une matière fermée ou hors programme", () => {
    expect(
      choosePersonalPractice({
        ...base,
        allowedNotions: new Set([b]),
        actions: [start(a)],
        intents: [{ id: "i1", notionId: a, misconceptionId: null }],
      }),
    ).toBeNull();
  });

  it("cible l'idée fausse, puis l'exercice le moins souvent reçu", () => {
    const focus: NextAction = {
      kind: "misconception_focus",
      notionId: a,
      misconceptionId: "m1",
      reason: "",
      evidence: [],
    };
    const intents = [
      { id: "i1", notionId: a, misconceptionId: null },
      { id: "i2", notionId: a, misconceptionId: "m1" },
      { id: "i3", notionId: a, misconceptionId: null },
    ];
    expect(
      choosePersonalPractice({ ...base, actions: [focus], intents })?.intentId,
    ).toBe("i2");
    expect(
      choosePersonalPractice({
        ...base,
        used: new Map([["i1", 2]]),
        actions: [{ kind: "practice", notionId: a, reason: "", evidence: [] }],
        intents,
      })?.intentId,
    ).toBe("i2");
  });

  it("l'entretien initial ne se prépare pas en exercice", () => {
    expect(
      choosePersonalPractice({
        ...base,
        actions: [{ kind: "intake", reason: "", evidence: [] }],
        intents: [{ id: "i1", notionId: a, misconceptionId: null }],
      }),
    ).toBeNull();
  });
});
