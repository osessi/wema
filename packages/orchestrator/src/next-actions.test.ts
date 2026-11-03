import {
  asEventId,
  asLearnerId,
  asNotionId,
  type LearningEvent,
} from "@wema/domain";
import { projectLearnerModel } from "@wema/learner-model";
import { describe, expect, it } from "vitest";
import { nextActions, nextReviewAt, nudgeReason } from "./index";

const learner = asLearnerId("1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d");
const a = asNotionId("notion-a");
const b = asNotionId("notion-b");
let n = 0;
const answer = (
  notionId: string,
  correct: boolean,
  at: string,
): LearningEvent => ({
  id: asEventId(`00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`),
  learnerId: learner,
  occurredAt: new Date(at),
  source: "web",
  payload: {
    type: "answer.submitted",
    notionId: asNotionId(notionId),
    correct,
    hintsUsed: 0,
    misconceptionId: null,
    exerciseRef: null,
    response: null,
    scaffolded: null,
    misconceptionSource: null,
    misconceptionConfidence: null,
  },
});
const intake: LearningEvent = {
  id: asEventId("00000000-0000-4000-8000-0000000000ff"),
  learnerId: learner,
  occurredAt: new Date("2026-10-01T08:00:00Z"),
  source: "web",
  payload: { type: "intake.completed", sessionId: "s", hypotheses: [] },
};

function actions(
  events: LearningEvent[],
  options: {
    prerequisites?: Map<string, ReturnType<typeof asNotionId>[]>;
    open?: {
      id: string;
      notionId: ReturnType<typeof asNotionId>;
      started?: boolean;
    }[];
    now?: string;
  } = {},
) {
  const model = projectLearnerModel(learner, events);
  if (!model.ok) throw new Error(model.error.kind);
  return nextActions({
    model: model.value,
    events,
    prerequisites: options.prerequisites ?? new Map(),
    openVariants: options.open ?? [],
    now: new Date(options.now ?? "2026-11-01T10:00:00Z"),
  });
}

describe("prochaines actions", () => {
  it("un exercice commencé passe avant tout, et l'entretien est proposé s'il manque", () => {
    const list = actions([answer(a, true, "2026-10-01T10:00:00Z")], {
      open: [{ id: "v1", notionId: a }],
    });
    // Une seule action par notion : l'exercice à terminer l'emporte sur la pratique.
    expect(list.map((x) => x.kind)).toEqual(["finish_exercise", "intake"]);
  });

  it("après 3 erreurs d'affilée : une victoire facile", () => {
    const list = actions([
      intake,
      answer(a, false, "2026-10-01T10:00:00Z"),
      answer(a, false, "2026-10-01T10:05:00Z"),
      answer(a, false, "2026-10-01T10:10:00Z"),
    ]);
    expect(list[0]).toMatchObject({ kind: "easy_win", notionId: a });
    expect(list[0]?.evidence).toHaveLength(3);
  });

  it("une notion qui bloque fait remonter au prérequis non validé", () => {
    const events = [
      intake,
      answer(b, false, "2026-10-01T10:00:00Z"),
      answer(b, true, "2026-10-01T10:05:00Z"),
      answer(b, false, "2026-10-01T10:10:00Z"),
    ];
    const list = actions(events, { prerequisites: new Map([[b, [a]]]) });
    expect(list[0]).toMatchObject({
      kind: "prerequisite_first",
      notionId: a,
      blockedNotionId: b,
    });
  });

  it("une notion validée revient en re-test après 3 jours, puis 7 après un rappel réussi", () => {
    const mastered = [
      intake,
      answer(a, true, "2026-10-01T10:00:00Z"),
      answer(a, true, "2026-10-01T10:05:00Z"),
      answer(a, true, "2026-10-01T10:10:00Z"),
      answer(a, true, "2026-10-05T10:00:00Z"),
    ];
    const model = projectLearnerModel(learner, mastered);
    if (!model.ok) throw new Error("profil");
    const masteredAt = model.value.notions[a]?.masteryCandidateAt;
    if (!masteredAt) throw new Error("notion non validée");
    expect(nextReviewAt(mastered, a, masteredAt).toISOString()).toBe(
      "2026-10-12T10:00:00.000Z",
    );
    expect(
      actions(mastered, { now: "2026-10-11T10:00:00Z" }).map((x) => x.kind),
    ).toEqual([]);
    expect(
      actions(mastered, { now: "2026-10-13T10:00:00Z" }).map((x) => x.kind),
    ).toEqual(["spaced_review"]);
  });

  it("un échec en re-test fait repartir l'intervalle au début", () => {
    const events = [
      answer(a, true, "2026-10-01T10:00:00Z"),
      answer(a, false, "2026-10-10T10:00:00Z"),
    ];
    expect(
      nextReviewAt(events, a, new Date("2026-10-01T10:00:00Z")).toISOString(),
    ).toBe("2026-10-13T10:00:00.000Z");
  });
});

describe("relance", () => {
  const list = actions([answer(a, true, "2026-10-01T10:00:00Z")]);
  it("seulement après 2 jours sans activité, et s'il y a quelque chose à faire", () => {
    expect(
      nudgeReason({
        actions: list,
        lastActivityAt: new Date("2026-10-31T12:00:00Z"),
        now: new Date("2026-11-01T10:00:00Z"),
      }),
    ).toBeNull();
    expect(
      nudgeReason({
        actions: list,
        lastActivityAt: new Date("2026-10-28T10:00:00Z"),
        now: new Date("2026-11-01T10:00:00Z"),
      })?.kind,
    ).toBe("practice");
    expect(
      nudgeReason({
        actions: [],
        lastActivityAt: new Date("2026-10-01T10:00:00Z"),
        now: new Date("2026-11-01T10:00:00Z"),
      }),
    ).toBeNull();
  });
});

describe("devoirs et programme", () => {
  it("un devoir proche de l'échéance passe en tête ; un devoir lointain reste un exercice à terminer", () => {
    const list = actions([intake], {
      open: [
        { id: "v-proche", notionId: a },
        { id: "v-loin", notionId: b },
      ],
    });
    expect(list.map((x) => x.kind)).toEqual([
      "finish_exercise",
      "finish_exercise",
    ]);
    const model = projectLearnerModel(learner, [intake]);
    if (!model.ok) throw new Error("profil");
    const withDue = nextActions({
      model: model.value,
      events: [intake],
      prerequisites: new Map(),
      openVariants: [
        { id: "v-proche", notionId: a },
        { id: "v-loin", notionId: b },
      ],
      assignments: [
        {
          variantId: "v-proche",
          notionId: a,
          dueAt: new Date("2026-11-02T18:00:00Z"),
        },
        {
          variantId: "v-loin",
          notionId: b,
          dueAt: new Date("2026-11-20T18:00:00Z"),
        },
      ],
      now: new Date("2026-11-01T10:00:00Z"),
    });
    expect(
      withDue.map((x) => [x.kind, "variantId" in x ? x.variantId : null]),
    ).toEqual([
      ["assignment_due", "v-proche"],
      ["finish_exercise", "v-loin"],
    ]);
  });

  it("propose la prochaine notion du programme dont les prérequis sont validés", () => {
    const model = projectLearnerModel(learner, [intake]);
    if (!model.ok) throw new Error("profil");
    const list = nextActions({
      model: model.value,
      events: [intake],
      prerequisites: new Map([[b, [a]]]),
      openVariants: [],
      programNotions: [b, a],
      now: new Date("2026-11-01T10:00:00Z"),
    });
    expect(list).toEqual([
      expect.objectContaining({ kind: "start_notion", notionId: a }),
    ]);
  });
});

describe("relecture du lot 7", () => {
  const c = asNotionId("notion-c");
  const fail3 = (notionId: string) => [
    answer(notionId, false, "2026-10-01T10:00:00Z"),
    answer(notionId, false, "2026-10-01T10:05:00Z"),
    answer(notionId, false, "2026-10-01T10:10:00Z"),
  ];

  it("victoire facile sur le prérequis manquant", () => {
    const list = actions([intake, ...fail3(b)], {
      prerequisites: new Map([[b, [a]]]),
    });
    expect(list[0]).toMatchObject({ kind: "easy_win", notionId: a });
  });

  it("deux notions bloquées par le même prérequis : une seule action sur ce prérequis", () => {
    const blocked = (n: string) => [
      answer(n, false, "2026-10-01T10:00:00Z"),
      answer(n, true, "2026-10-01T10:05:00Z"),
      answer(n, false, "2026-10-01T10:10:00Z"),
    ];
    const list = actions(
      [
        intake,
        ...blocked(b),
        ...blocked(c),
        answer(a, false, "2026-10-01T11:00:00Z"),
      ],
      {
        prerequisites: new Map([
          [b, [a]],
          [c, [a]],
        ]),
      },
    );
    expect(
      list.filter((x) => "notionId" in x && x.notionId === a),
    ).toHaveLength(1);
  });

  it("une seule action « exercice » par notion, et un libellé distinct s'il n'est pas commencé", () => {
    const list = actions([intake], {
      open: [
        { id: "v1", notionId: a },
        { id: "v2", notionId: a, started: true },
        { id: "v3", notionId: b },
      ],
    });
    expect(list.map((x) => ("variantId" in x ? x.variantId : null))).toEqual([
      "v2",
      "v3",
    ]);
    expect(list[1]?.reason).toBe("Un exercice t'attend, pas encore commencé.");
  });

  it("une notion ou une idée fausse archivée n'est jamais proposée", () => {
    const model = projectLearnerModel(learner, [intake, ...fail3(a)]);
    if (!model.ok) throw new Error("profil");
    const list = nextActions({
      model: model.value,
      events: [intake, ...fail3(a)],
      prerequisites: new Map([[b, [a]]]),
      openVariants: [{ id: "v1", notionId: a }],
      programNotions: [a, b],
      activeNotions: new Set([b]),
      now: new Date("2026-11-01T10:00:00Z"),
    });
    expect(list.map((x) => x.kind)).toEqual(["start_notion"]);
    expect(list[0]).toMatchObject({ notionId: b });
  });
});

describe("espacement des relances", () => {
  const list = actions([answer(a, true, "2026-10-01T10:00:00Z")]);
  const lastActivityAt = new Date("2026-10-01T10:00:00Z");
  const reason = (
    now: string,
    previousNudges: { createdAt: Date; read: boolean }[] = [],
  ) =>
    nudgeReason({
      actions: list,
      lastActivityAt,
      previousNudges,
      now: new Date(now),
    })?.kind ?? null;

  it("2 jours, puis 4 jours après une relance lue ; rien tant qu'une relance n'est pas lue", () => {
    expect(reason("2026-10-03T11:00:00Z")).toBe("practice");
    const first = { createdAt: new Date("2026-10-03T11:00:00Z"), read: true };
    expect(reason("2026-10-04T12:00:00Z", [first])).toBeNull();
    expect(reason("2026-10-07T12:00:00Z", [first])).toBe("practice");
    expect(
      reason("2026-10-20T12:00:00Z", [{ ...first, read: false }]),
    ).toBeNull();
  });

  it("au plus 4 relances sans aucune activité", () => {
    const read = (d: string) => ({ createdAt: new Date(d), read: true });
    const four = [
      read("2026-10-25T10:00:00Z"),
      read("2026-10-15T10:00:00Z"),
      read("2026-10-08T10:00:00Z"),
      read("2026-10-04T10:00:00Z"),
    ];
    expect(reason("2026-12-01T10:00:00Z", four)).toBeNull();
  });
});
