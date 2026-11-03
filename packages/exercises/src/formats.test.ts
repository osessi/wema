import {
  type AiProvider,
  createAiGateway,
  DEFAULT_ROUTING,
} from "@wema/ai-gateway";
import {
  asEventId,
  asLearnerId,
  asNotionId,
  type CanonicalAnswer,
  err,
  type Hypothesis,
  type LearningEvent,
  ok,
  type PresentationFormat,
} from "@wema/domain";
import { DEFAULT_SETTINGS } from "@wema/learner-model";
import { describe, expect, it } from "vitest";
import {
  adaptToComics,
  adaptToEasyReading,
  type ComicsContent,
  checkFaithful,
  choosePresentation,
  extractNumbers,
  figureFor,
  matchForm,
  measureFormats,
  planVariant,
  splitSentences,
} from "./index";

// --- Contrôle des nombres -------------------------------------------------

const equation = {
  statement: "Résous l'équation 3x + 5 = 20.",
  rendered: { equation: { text: "3x + 5 = 20", latex: "3x+5=20" } },
  answer: {
    kind: "solutions",
    variable: "x",
    values: ["5"],
  } satisfies CanonicalAnswer,
};
const triangle = {
  statement:
    "Le triangle ABC est rectangle en A, avec AB = 3 cm et AC = 4 cm. Calcule BC, arrondie au dixième.",
  rendered: {},
  answer: {
    kind: "number",
    value: "5.0",
    decimals: 1,
  } satisfies CanonicalAnswer,
};

describe("extractNumbers", () => {
  it("lit les entiers et les décimaux (virgule ou point), sans zéros inutiles", () => {
    expect(extractNumbers("AB = 3 cm, 4,50 € et 007 billes ; 2.5")).toEqual([
      "3",
      "4.5",
      "7",
      "2.5",
    ]);
  });
});

describe("checkFaithful", () => {
  it("accepte une reformulation qui garde la formule et les nombres", () => {
    expect(
      checkFaithful({
        ...equation,
        produced: ["Léa a une balance.", "Elle écrit 3x+5 = 20. Trouve x !"],
      }).ok,
    ).toBe(true);
  });

  it("refuse une formule modifiée", () => {
    expect(
      checkFaithful({ ...equation, produced: ["Résous 3x + 6 = 20."] }),
    ).toEqual(err({ kind: "formula_missing", formula: "3x + 5 = 20" }));
  });

  it("refuse un nombre manquant, changé ou ajouté", () => {
    expect(
      checkFaithful({ ...triangle, produced: ["AB = 3 cm. Calcule BC."] }),
    ).toEqual(err({ kind: "number_missing", number: "4" }));
    expect(
      checkFaithful({
        ...triangle,
        produced: ["AB = 3 cm et AC = 4 cm. Il est 8 h. Calcule BC."],
      }),
    ).toEqual(err({ kind: "number_added", number: "8" }));
  });

  it("refuse une reformulation qui donne la réponse", () => {
    expect(
      checkFaithful({
        ...equation,
        produced: ["3x + 5 = 20, donc x = 5 bien sûr."],
      }),
    ).toEqual(err({ kind: "answer_leaked" }));
    expect(
      checkFaithful({
        ...triangle,
        produced: ["AB = 3 cm, AC = 4 cm : BC vaut 5. Calcule BC."],
      }).ok,
    ).toBe(false);
  });
});

// --- Gabarits de figure ----------------------------------------------------

describe("figureFor", () => {
  it("lie une forme de tâche aux paramètres, quel que soit leur nom", () => {
    expect(matchForm("{p}*{v}+{q}={r}", "k*y + m = n", "y")).toEqual({
      p: "k",
      v: "y",
      q: "m",
      r: "n",
    });
    expect(matchForm("{p}*{v}+{q}={r}", "k*y + m = n", "x")).toBeNull();
  });

  it("équation ax + b = c à poids positifs : une balance", () => {
    expect(
      figureFor(
        { kind: "solve", equation: "a*x + b = c", variable: "x" },
        { a: 3, b: 5, c: 20 },
      ),
    ).toEqual({
      kind: "balance",
      variable: "x",
      left: { coefficient: 3, constant: 5 },
      right: { coefficient: 0, constant: 20 },
    });
  });

  it("pas de balance avec un poids négatif", () => {
    expect(
      figureFor(
        { kind: "solve", equation: "a*x + b = c", variable: "x" },
        { a: 3, b: -5, c: 20 },
      ),
    ).toBeNull();
  });

  it("hypoténuse de Pythagore : triangle rectangle coté, la longueur cherchée est inconnue", () => {
    expect(
      figureFor(
        { kind: "evaluate", expression: "sqrt(a**2 + b**2)", round: 1 },
        { a: 3, b: 4 },
      ),
    ).toEqual({ kind: "right_triangle", legs: [3, 4], hypotenuse: null });
    expect(
      figureFor(
        { kind: "evaluate", expression: "sqrt(c**2 - a**2)" },
        { a: 3, c: 5 },
      ),
    ).toEqual({ kind: "right_triangle", legs: [3, null], hypotenuse: 5 });
  });

  it("somme et différence : droite graduée ; carré : figure du carré", () => {
    expect(
      figureFor({ kind: "evaluate", expression: "a - b" }, { a: 2, b: 7 }),
    ).toEqual({ kind: "number_line", start: 2, step: -7 });
    expect(
      figureFor({ kind: "evaluate", expression: "a**2" }, { a: 6 }),
    ).toEqual({ kind: "square", side: 6 });
  });

  it("aucun gabarit : pas de schéma", () => {
    expect(
      figureFor({ kind: "expand", expression: "k*(x + a)" }, { k: 2, a: 3 }),
    ).toBeNull();
  });
});

// --- Choix du format -------------------------------------------------------

const hypothesis = (
  key: string,
  confidence: number,
  status: Hypothesis["status"] = "supported",
): Hypothesis => ({
  key,
  statement: key,
  sources: ["declared_guardian"],
  confidence,
  status,
  evidence: [],
});

let n = 0;
const answer = (
  format: PresentationFormat | null,
  correct: boolean,
): LearningEvent => ({
  id: asEventId(`00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`),
  learnerId: asLearnerId("00000000-0000-4000-8000-000000000001"),
  occurredAt: new Date(2026, 0, 1, 0, n),
  source: "web",
  payload: {
    type: "answer.submitted",
    notionId: asNotionId("n"),
    correct,
    hintsUsed: 0,
    misconceptionId: null,
    exerciseRef: null,
    response: null,
    misconceptionSource: null,
    misconceptionConfidence: null,
    scaffolded: false,
    format,
  },
});
const answers = (
  format: PresentationFormat,
  correct: number,
  wrong: number,
) => [
  ...Array.from({ length: correct }, () => answer(format, true)),
  ...Array.from({ length: wrong }, () => answer(format, false)),
];

const ALL: PresentationFormat[] = [
  "easy_reading",
  "diagram",
  "comics",
  "audio",
];

describe("choosePresentation", () => {
  it("sans rien dans le profil : le texte", () => {
    const choice = choosePresentation({
      available: ALL,
      hypotheses: [],
      outcomes: {},
    });
    expect(choice.format).toBe("text");
    expect(choice.reason).toBe("default");
  });

  it("suit une préférence déclarée, pondérée par sa confiance", () => {
    const choice = choosePresentation({
      available: ALL,
      hypotheses: [
        hypothesis("format.visual", 0.5),
        hypothesis("format.comics", 0.65),
      ],
      outcomes: {},
    });
    expect(choice.format).toBe("comics");
    expect(choice.reason).toBe("preference");
    expect(choice.ranking.map((r) => r.format).slice(0, 2)).toEqual([
      "comics",
      "diagram",
    ]);
  });

  it("une préférence démentie ou incertaine ne compte pas pour le format", () => {
    expect(
      choosePresentation({
        available: ALL,
        hypotheses: [
          hypothesis("format.visual", 0.5, "contradicted"),
          hypothesis("format.comics", 0.4, "uncertain"),
        ],
        outcomes: {},
      }).format,
    ).toBe("text");
  });

  it("ne propose pas un format indisponible (pas de schéma sans gabarit)", () => {
    const choice = choosePresentation({
      available: ["easy_reading", "audio"],
      hypotheses: [hypothesis("format.visual", 0.8)],
      outcomes: {},
    });
    expect(choice.format).toBe("text");
    expect(choice.ranking.some((r) => r.format === "diagram")).toBe(false);
  });

  it("une adaptation liée à un besoin déclaré choisit la lecture facile, sans le nommer", () => {
    const choice = choosePresentation({
      available: ALL,
      hypotheses: [],
      outcomes: {},
      needs: ["need.dyslexia"],
    });
    expect(choice).toMatchObject({
      format: "easy_reading",
      reason: "adaptation",
    });
  });

  it("apprend ce qui marche : la mesure l'emporte sur une préférence quand les données suffisent", () => {
    const outcomes = measureFormats([
      ...answers("comics", 3, 9),
      ...answers("diagram", 10, 2),
    ]);
    expect(outcomes.comics).toEqual({ attempts: 12, correct: 3 });
    const choice = choosePresentation({
      available: ALL,
      hypotheses: [hypothesis("format.comics", 0.5)],
      outcomes,
    });
    expect(choice.format).toBe("diagram");
    expect(choice.reason).toBe("measured");
  });

  it("trop peu de réponses : la mesure ne pèse pas", () => {
    const choice = choosePresentation({
      available: ALL,
      hypotheses: [hypothesis("format.comics", 0.5)],
      outcomes: measureFormats([
        ...answers("comics", 0, 3),
        ...answers("text", 3, 0),
      ]),
    });
    expect(choice.format).toBe("comics");
    expect(choice.ranking.every((r) => r.measured === 0)).toBe(true);
  });

  it("les réponses sans format connu (avant le lot 11) sont ignorées", () => {
    expect(measureFormats([answer(null, true)])).toEqual({});
  });

  it("le format ne change jamais la variante : planVariant ne dépend pas du profil de format", () => {
    const intent = { misconceptionId: null };
    const before = planVariant(intent, undefined, DEFAULT_SETTINGS);
    choosePresentation({
      available: ALL,
      hypotheses: [hypothesis("format.comics", 0.8)],
      outcomes: {},
    });
    expect(planVariant(intent, undefined, DEFAULT_SETTINGS)).toEqual(before);
  });
});

// --- Reformulations par l'IA -----------------------------------------------

function fakeAi(reply: unknown) {
  const calls: string[] = [];
  const provider: AiProvider = {
    name: "openrouter",
    async generate(request) {
      calls.push(request.messages.map((m) => m.content).join("\n"));
      return ok({
        text: JSON.stringify(reply),
        model: "test/modele",
        usage: { inputTokens: 1, outputTokens: 1, costUsd: 0 },
      });
    },
    async stream() {
      return err({ kind: "unavailable", message: "", retryable: false });
    },
  };
  const ai = createAiGateway({
    providers: { openrouter: provider },
    routing: async () => DEFAULT_ROUTING,
    log: async () => {},
    retryDelayMs: 0,
  });
  return { ai, calls };
}

const comics = (lastText: string): ComicsContent => ({
  title: "La balance de Léa",
  characters: [{ id: "lea", name: "Léa", look: "round", color: "mint" }],
  panels: [
    {
      place: "shop",
      setting: "Une épicerie avec une grande balance.",
      caption: null,
      bubbles: [
        { speaker: "lea", kind: "speech", text: "Regarde ma balance !" },
      ],
    },
    {
      place: "shop",
      setting: "Léa pose des sacs.",
      caption: "Les deux plateaux sont à l'équilibre.",
      bubbles: [],
    },
    {
      place: "shop",
      setting: "Léa montre un papier.",
      caption: null,
      bubbles: [{ speaker: "lea", kind: "thought", text: lastText }],
    },
  ],
});
const context = { organizationId: null, learnerId: null };

describe("adaptToComics", () => {
  it("garde une BD fidèle, sans envoyer la réponse à l'IA", async () => {
    const { ai, calls } = fakeAi(comics("Résous 3x + 5 = 20 !"));
    const result = await adaptToComics({ ai, ...equation, context });
    expect(result.ok).toBe(true);
    expect(calls[0]).toContain("3x + 5 = 20");
    expect(calls[0]).not.toContain("x = 5");
  });

  it("écarte une BD qui change un nombre", async () => {
    const { ai } = fakeAi(comics("Résous 3x + 5 = 21 !"));
    const result = await adaptToComics({ ai, ...equation, context });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("unfaithful");
  });

  it("écarte une sortie hors schéma (bulle d'un personnage inconnu)", async () => {
    const bad = comics("Résous 3x + 5 = 20 !");
    const [first] = bad.panels;
    if (first) first.bubbles = [{ speaker: "zoe", kind: "speech", text: "Hé" }];
    const { ai } = fakeAi(bad);
    const result = await adaptToComics({ ai, ...equation, context });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("ai");
  });
});

describe("lecture facile", () => {
  it("garde des phrases courtes fidèles", async () => {
    const { ai } = fakeAi({
      sentences: [
        "ABC est un triangle rectangle en A.",
        "AB = 3 cm.",
        "AC = 4 cm.",
        "Calcule BC. Arrondis au dixième.",
      ],
    });
    expect((await adaptToEasyReading({ ai, ...triangle, context })).ok).toBe(
      true,
    );
  });

  it("sans IA : l'énoncé découpé en phrases, données intactes", () => {
    expect(splitSentences(triangle.statement).sentences).toEqual([
      "Le triangle ABC est rectangle en A, avec AB = 3 cm et AC = 4 cm.",
      "Calcule BC, arrondie au dixième.",
    ]);
  });
});
