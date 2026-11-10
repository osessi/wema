// Cas limites de la déclinaison des variantes (tests de justesse du tour 4).
import {
  asEventId,
  asMisconceptionId,
  asNotionId,
  type CanonicalAnswer,
  err,
} from "@wema/domain";
import { DEFAULT_SETTINGS, type NotionState } from "@wema/learner-model";
import { describe, expect, it } from "vitest";
import {
  checkFaithful,
  chooseParameters,
  extractNumbers,
  pickWeeklyNotions,
  planVariant,
} from "./index";

const mis = asMisconceptionId("m-signe");
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
          misconceptionId: mis,
          occurrences: 2,
          lastSeenAt: new Date(),
          active: true,
          evidence: [],
        },
      ]
    : [],
});

describe("planVariant : seuils exacts", () => {
  const free = { misconceptionId: null };
  it("à 0,5 pile : niveau intermédiaire ; à 0,95 pile : niveau exigeant sans indice", () => {
    expect(planVariant(free, state(0.5))).toEqual({
      level: 2,
      scaffolded: false,
      hintLevel: 1,
    });
    expect(planVariant(free, state(0.4999))).toMatchObject({ level: 1 });
    expect(planVariant(free, state(0.95))).toEqual({
      level: 3,
      scaffolded: false,
      hintLevel: 0,
    });
  });

  it("notion connue seulement par une copie relue (aucune réponse) : comme une notion nouvelle", () => {
    expect(planVariant(free, state(DEFAULT_SETTINGS.bkt.pInit, 0))).toEqual({
      level: 1,
      scaffolded: true,
      hintLevel: 1,
    });
  });

  it("candidat à la validation visé par son idée fausse active : guidé, mais sans indice ni baisse de niveau", () => {
    expect(planVariant({ misconceptionId: mis }, state(0.97, 6, true))).toEqual(
      { level: 3, scaffolded: true, hintLevel: 0 },
    );
    // Idée fausse levée : plus de guidage.
    expect(
      planVariant({ misconceptionId: mis }, state(0.97, 6, false)),
    ).toMatchObject({ scaffolded: false });
  });

  it("un gain collectif ne guide jamais un candidat à la validation", () => {
    expect(
      planVariant(free, state(0.96), DEFAULT_SETTINGS, {
        scaffoldingGain: 0.5,
      }),
    ).toMatchObject({ level: 3, scaffolded: false });
    expect(
      planVariant(free, state(0.7), DEFAULT_SETTINGS, {
        scaffoldingGain: 0.15,
      }),
    ).toMatchObject({ level: 2, scaffolded: true });
    expect(
      planVariant(free, state(0.7), DEFAULT_SETTINGS, {
        scaffoldingGain: 0.1499,
      }),
    ).toMatchObject({ scaffolded: false });
  });
});

describe("paramètres : plages extrêmes", () => {
  it("la plage la plus large permise (−10 000 à 10 000) est tirée sur toute son étendue", () => {
    const spec = [
      { name: "a", ranges: [{ min: -10_000, max: 10_000 }], exclude: [0] },
    ];
    const values = Array.from(
      { length: 400 },
      (_, seed) => chooseParameters(spec, 1, seed)?.a ?? Number.NaN,
    );
    expect(values.every((v) => v >= -10_000 && v <= 10_000 && v !== 0)).toBe(
      true,
    );
    expect(Math.min(...values)).toBeLessThan(-5_000);
    expect(Math.max(...values)).toBeGreaterThan(5_000);
  });

  it("au-delà des plages fournies, la dernière sert ; une plage vide rend null", () => {
    const spec = [{ name: "a", ranges: [{ min: 1, max: 1 }], exclude: [] }];
    expect(chooseParameters(spec, 3, 7)).toEqual({ a: 1 });
    expect(
      chooseParameters(
        [{ name: "a", ranges: [{ min: 5, max: 1 }], exclude: [] }],
        1,
        1,
      ),
    ).toBeNull();
  });
});

describe("contrôle des nombres d'une reformulation", () => {
  const eq = {
    statement: "Résous l'équation 3x − 7 = −13.",
    rendered: { equation: { text: "3x − 7 = −13", latex: "3x-7=-13" } },
    answer: {
      kind: "solutions",
      variable: "x",
      values: ["-2"],
    } satisfies CanonicalAnswer,
  };

  it("signes moins typographiques et emoji n'empêchent pas une reformulation fidèle", () => {
    expect(
      checkFaithful({
        ...eq,
        produced: [
          "🧮 Léa écrit 3x − 7 = −13 au tableau.",
          "Qui trouve x ? 🎉",
        ],
      }).ok,
    ).toBe(true);
  });

  it("la réponse négative est refusée, quel que soit le tiret employé (même si le nombre figure déjà dans l'énoncé)", () => {
    for (const leak of ["x = −2", "x = -2", "x=–2"])
      expect(
        checkFaithful({ ...eq, produced: [`3x − 7 = −13, donc ${leak}.`] }).ok,
      ).toBe(false);
    // L'énoncé contient déjà un 2 : seul le contrôle de la réponse peut refuser.
    const withTwo = {
      ...eq,
      statement: "Résous l'équation 2x + 9 = 5.",
      rendered: { equation: { text: "2x + 9 = 5", latex: "2x+9=5" } },
    };
    for (const leak of ["x = −2", "x = -2", "x=–2"])
      expect(
        checkFaithful({ ...withTwo, produced: [`2x + 9 = 5, donc ${leak}.`] }),
      ).toEqual(err({ kind: "answer_leaked" }));
  });

  it("un très grand nombre ajouté est refusé ; les nombres sont lus en entier", () => {
    expect(extractNumbers("12345678901234567890 et 0,000")).toEqual([
      "12345678901234567890",
      "0",
    ]);
    expect(
      checkFaithful({
        ...eq,
        produced: ["3x − 7 = −13 ; 99999999999999999999 élèves cherchent."],
      }),
    ).toEqual(err({ kind: "number_added", number: "99999999999999999999" }));
  });

  it("une reformulation très longue reste contrôlée (pas de nombre perdu au milieu)", () => {
    const filler = "Il était une fois une classe très curieuse. ".repeat(500);
    expect(
      checkFaithful({ ...eq, produced: [`${filler}3x − 7 = −13 ${filler}`] })
        .ok,
    ).toBe(true);
    expect(
      checkFaithful({
        ...eq,
        produced: [`${filler}3x − 7 = −13 ${filler} 42`],
      }),
    ).toEqual(err({ kind: "number_added", number: "42" }));
  });
});

describe("banque : choix des notions, cas limites", () => {
  const d = (
    code: string,
    position: number,
    counts: Partial<
      Record<"not_seen" | "needs_work" | "in_progress" | "mastered", number>
    >,
  ) => ({
    notionId: asNotionId(`n-${code}`),
    name: code,
    description: "",
    context: "",
    position,
    counts: {
      not_seen: 0,
      needs_work: 0,
      in_progress: 0,
      mastered: 0,
      ...counts,
    },
    misconceptions: [],
    alreadyProposed: 0,
    existingObjectives: [],
  });

  it("aucun plafond : rien ; tout est maîtrisé : rien", () => {
    expect(
      pickWeeklyNotions([d("a", 0, { needs_work: 1 })], { maxNotions: 0 }),
    ).toEqual([]);
    expect(pickWeeklyNotions([d("a", 0, { mastered: 5 })])).toEqual([]);
  });

  it("à égalité de difficulté, l'ordre du programme départage", () => {
    const picked = pickWeeklyNotions(
      [
        d("c", 2, { needs_work: 2 }),
        d("a", 0, { needs_work: 2 }),
        d("b", 1, { needs_work: 2 }),
      ],
      { maxNotions: 3 },
    );
    expect(picked.map((x) => x.name)).toEqual(["a", "b", "c"]);
  });
});
