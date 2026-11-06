// Cas limites des règles du profil (tests de justesse du tour 4).
import {
  asEventId,
  asLearnerId,
  asMisconceptionId,
  asNotionId,
  type LearningEvent,
} from "@wema/domain";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_BKT,
  DEFAULT_SETTINGS,
  MASTERY_CEILING,
  notionStatus,
  projectLearnerModel,
  updateMastery,
} from "./index";

const learner = asLearnerId("1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d");
const n1 = asNotionId("maths.equations");
const n2 = asNotionId("maths.fractions");
let counter = 0;

function answer(
  at: string,
  correct: boolean,
  options: {
    notion?: string;
    misconception?: string;
    ai?: number;
    id?: string;
  } = {},
): LearningEvent {
  counter += 1;
  return {
    id: asEventId(
      options.id ??
        `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`,
    ),
    learnerId: learner,
    occurredAt: new Date(at),
    source: "web",
    payload: {
      type: "answer.submitted",
      notionId: asNotionId(options.notion ?? n1),
      correct,
      hintsUsed: 0,
      misconceptionId: options.misconception
        ? asMisconceptionId(options.misconception)
        : null,
      exerciseRef: null,
      response: null,
      scaffolded: null,
      misconceptionSource: options.ai === undefined ? null : "ai",
      misconceptionConfidence: options.ai ?? null,
      format: null,
    },
  };
}

function project(events: LearningEvent[], settings = DEFAULT_SETTINGS) {
  const result = projectLearnerModel(learner, events, settings);
  if (!result.ok) throw new Error(result.error.kind);
  return result.value;
}

/** Trois bonnes réponses le même soir : maîtrise ≥ 0,95, seuil franchi à 18:10. */
const session = (day = "2026-10-01") => [
  answer(`${day}T18:00:00Z`, true),
  answer(`${day}T18:05:00Z`, true),
  answer(`${day}T18:10:00Z`, true),
];

describe("reconfirmation à 72 h", () => {
  it("une bonne réponse à 72 h pile valide la notion", () => {
    const model = project([...session(), answer("2026-10-04T18:10:00Z", true)]);
    expect(notionStatus(model, n1)).toBe("mastered");
  });

  it("une erreur qui fait repasser sous le seuil annule la validation : il faut un nouveau délai de 72 h", () => {
    const validated = [...session(), answer("2026-10-04T18:10:00Z", true)];
    const slipped = [
      ...validated,
      answer("2026-10-05T18:00:00Z", false),
      answer("2026-10-05T18:05:00Z", false),
    ];
    expect(notionStatus(project(slipped), n1)).toBe("in_progress");
    // Remonte au-dessus du seuil le lendemain : candidate à nouveau, pas validée.
    const back = [
      ...slipped,
      answer("2026-10-06T17:55:00Z", true),
      answer("2026-10-06T18:00:00Z", true),
    ];
    const state = project(back).notions[n1];
    expect(state?.pKnown).toBeGreaterThanOrEqual(0.95);
    expect(state?.masteryCandidateAt?.toISOString()).toBe(
      "2026-10-06T17:55:00.000Z",
    );
    expect(state?.status).toBe("in_progress");
    expect(
      notionStatus(
        project([...back, answer("2026-10-09T18:00:00Z", true)]),
        n1,
      ),
    ).toBe("mastered");
  });

  it("une erreur au-dessus du seuil après validation ne la retire que si la maîtrise retombe", () => {
    // Beaucoup de bonnes réponses : une seule erreur ne fait pas retomber sous 0,95.
    const strong = [
      ...session(),
      answer("2026-10-04T18:10:00Z", true),
      answer("2026-10-04T18:20:00Z", true),
      answer("2026-10-04T18:30:00Z", true),
    ];
    const pBefore = project(strong).notions[n1]?.pKnown ?? 0;
    const after = updateMastery(pBefore, false, DEFAULT_BKT);
    const model = project([...strong, answer("2026-10-05T18:00:00Z", false)]);
    expect(model.notions[n1]?.pKnown).toBeCloseTo(after, 10);
    expect(notionStatus(model, n1)).toBe(
      after >= 0.95 ? "mastered" : "in_progress",
    );
  });

  it("le délai se compte en heures réelles, sans dépendre du fuseau ni du changement d'heure", () => {
    // Passage à l'heure d'hiver en France le 25 octobre 2026 : du 24 à 10:00
    // (UTC+2) au 27 à 09:00 (UTC+1), il s'écoule exactement 72 h.
    const local = [
      answer("2026-10-24T09:50:00+02:00", true),
      answer("2026-10-24T09:55:00+02:00", true),
      answer("2026-10-24T10:00:00+02:00", true),
      answer("2026-10-27T09:00:00+01:00", true),
    ];
    expect(notionStatus(project(local), n1)).toBe("mastered");
    const early = [
      ...local.slice(0, 3),
      answer("2026-10-27T08:59:00+01:00", true),
    ];
    expect(notionStatus(project(early), n1)).toBe("in_progress");
  });

  it("mêmes instants écrits dans des fuseaux différents : même profil", () => {
    const utc = [
      answer("2026-10-01T22:30:00Z", false, {
        id: "00000000-0000-4000-8000-0000000f0001",
      }),
      answer("2026-10-02T08:00:00Z", true, {
        id: "00000000-0000-4000-8000-0000000f0002",
      }),
    ];
    const elsewhere = [
      answer("2026-10-02T00:30:00+02:00", false, {
        id: "00000000-0000-4000-8000-0000000f0001",
      }),
      answer("2026-10-01T23:00:00-09:00", true, {
        id: "00000000-0000-4000-8000-0000000f0002",
      }),
    ];
    expect(project(elsewhere)).toEqual(project(utc));
  });
});

describe("projection rejouée", () => {
  it("rejouer le même journal, mélangé, avec des réponses à la même milliseconde, donne le même profil", () => {
    const events = [
      ...session(),
      answer("2026-10-02T10:00:00Z", false, {
        notion: n2,
        misconception: "mis-a",
      }),
      answer("2026-10-02T10:00:00Z", true, { notion: n2 }),
      answer("2026-10-02T10:00:00Z", false, {
        notion: n2,
        misconception: "mis-a",
      }),
      answer("2026-10-04T18:10:00Z", true),
      answer("2026-10-05T10:00:00Z", true, { notion: n2 }),
    ];
    const reference = project(events);
    // Quelques permutations déterministes du journal.
    for (const shift of [1, 3, 5]) {
      const shuffled = events.map(
        (_, i) => events[(i * shift + 2) % events.length] as LearningEvent,
      );
      expect(new Set(shuffled).size).toBe(events.length);
      expect(project(shuffled)).toEqual(reference);
    }
    expect(project([...events].reverse())).toEqual(reference);
    expect(project(events)).toEqual(reference);
  });

  it("un réglage changé s'applique à tout l'historique (le profil est recalculé)", () => {
    const events = [...session(), answer("2026-10-02T18:10:00Z", true)];
    expect(notionStatus(project(events), n1)).toBe("in_progress");
    expect(
      notionStatus(
        project(events, { ...DEFAULT_SETTINGS, reconfirmDelayHours: 24 }),
        n1,
      ),
    ).toBe("mastered");
  });
});

describe("idées fausses", () => {
  const mis = (events: LearningEvent[], id = "mis-signe") =>
    project(events).notions[n1]?.misconceptions.find(
      (m) => m.misconceptionId === id,
    );

  it("repérée par l'IA peu sûre : active à la deuxième occurrence ; une bonne réponse entre les deux ne l'efface pas", () => {
    const first = answer("2026-10-01T10:00:00Z", false, {
      misconception: "mis-signe",
      ai: 0.6,
    });
    const good = answer("2026-10-01T10:05:00Z", true);
    const second = answer("2026-10-01T10:10:00Z", false, {
      misconception: "mis-signe",
      ai: 0.6,
    });
    expect(mis([first])?.active).toBe(false);
    expect(mis([first, good, second])).toMatchObject({
      occurrences: 2,
      active: true,
    });
  });

  it("à 0,85 pile, une seule occurrence suffit", () => {
    expect(
      mis([
        answer("2026-10-01T10:00:00Z", false, {
          misconception: "mis-signe",
          ai: 0.85,
        }),
      ])?.active,
    ).toBe(true);
  });

  it("les bonnes réponses d'une autre notion ne lèvent pas l'idée fausse", () => {
    const events = [
      answer("2026-10-01T10:00:00Z", false, { misconception: "mis-signe" }),
      answer("2026-10-01T10:05:00Z", true, { notion: n2 }),
      answer("2026-10-01T10:10:00Z", true, { notion: n2 }),
    ];
    expect(mis(events)?.active).toBe(true);
  });

  it("une réponse juste qui montre encore l'idée fausse remet le compteur à zéro", () => {
    const events = [
      answer("2026-10-01T10:00:00Z", false, { misconception: "mis-signe" }),
      answer("2026-10-01T10:05:00Z", true),
      answer("2026-10-01T10:10:00Z", true, { misconception: "mis-signe" }),
      answer("2026-10-01T10:15:00Z", true),
    ];
    expect(mis(events)).toMatchObject({ occurrences: 2, active: true });
    expect(mis([...events, answer("2026-10-01T10:20:00Z", true)])?.active).toBe(
      false,
    );
  });
});

describe("BKT", () => {
  it("après 30 bonnes réponses, la maîtrise n'est pas figée à 1 : 4 erreurs d'affilée retirent la validation", () => {
    let p = DEFAULT_BKT.pInit;
    for (let i = 0; i < 30; i++) p = updateMastery(p, true, DEFAULT_BKT);
    expect(p).toBe(MASTERY_CEILING);
    for (let i = 0; i < 4; i++) p = updateMastery(p, false, DEFAULT_BKT);
    expect(p).toBeLessThan(DEFAULT_SETTINGS.masteryThreshold);
    // Même chose à travers le profil : la notion validée redevient « en cours ».
    const many = [
      ...Array.from({ length: 30 }, (_, i) =>
        answer(`2026-10-0${1 + Math.floor(i / 10)}T1${i % 10}:00:00Z`, true),
      ),
      answer("2026-10-06T10:00:00Z", true),
    ];
    expect(notionStatus(project(many), n1)).toBe("mastered");
    const errors = Array.from({ length: 4 }, (_, i) =>
      answer(`2026-10-07T10:0${i}:00Z`, false),
    );
    expect(notionStatus(project([...many, ...errors]), n1)).toBe("in_progress");
  });

  it("la maîtrise reste dans ]0, 1[ après de longues séries", () => {
    let p = DEFAULT_BKT.pInit;
    for (let i = 0; i < 1000; i++) p = updateMastery(p, true, DEFAULT_BKT);
    expect(p).toBeLessThanOrEqual(1);
    expect(p).toBeGreaterThan(0.999);
    for (let i = 0; i < 1000; i++) p = updateMastery(p, false, DEFAULT_BKT);
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThan(DEFAULT_SETTINGS.inProgressThreshold);
    expect(Number.isFinite(p)).toBe(true);
  });

  it("une bonne réponse fait toujours monter la maîtrise, une erreur la fait baisser au-dessus du plancher d'apprentissage", () => {
    for (const p of [0.2, 0.5, 0.8, 0.95, 0.99]) {
      expect(updateMastery(p, true, DEFAULT_BKT)).toBeGreaterThan(p);
      expect(updateMastery(p, false, DEFAULT_BKT)).toBeLessThan(p);
    }
  });
});
