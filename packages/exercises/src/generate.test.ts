import { type ExerciseTask, err, ok } from "@wema/domain";
import { describe, expect, it } from "vitest";
import {
  chooseParameters,
  generateVariant,
  type MathVerifier,
  renderTemplate,
  seedFrom,
  validateIntent,
} from "./index";

const intent = {
  task: {
    kind: "solve",
    equation: "a*x + b = c",
    variable: "x",
  } satisfies ExerciseTask,
  parameters: [
    {
      name: "a",
      ranges: [
        { min: 2, max: 5 },
        { min: 6, max: 12 },
      ],
      exclude: [],
    },
    { name: "b", ranges: [{ min: -9, max: 9 }], exclude: [0] },
    { name: "c", ranges: [{ min: 1, max: 30 }], exclude: [] },
  ],
  constraints: ["Eq(Mod(c - b, a), 0)"],
  statement: "Résous l'équation {equation}.",
  steps: ["Retire {b} des deux membres.", "Divise par {a}."],
  expected: null,
};

/** Faux services/math : premier jeu où (c - b) est divisible par a. */
function fakeVerifier(calls: number[] = []): MathVerifier {
  return {
    async checkExercise({ parameterSets }) {
      calls.push(parameterSets.length);
      const index = parameterSets.findIndex(
        (p) => ((p.c ?? 0) - (p.b ?? 0)) % (p.a ?? 1) === 0,
      );
      const p = parameterSets[index];
      if (!p) return err({ kind: "check_failed", reason: "constraint_failed" });
      const a = p.a ?? 1;
      const b = p.b ?? 0;
      const c = p.c ?? 0;
      return ok({
        index,
        answer: {
          kind: "solutions",
          variable: "x",
          values: [String((c - b) / a)],
        },
        rendered: { equation: { text: `${a}x + ${b} = ${c}`, latex: "" } },
      });
    },
    checkAnswer: async () => ok({ correct: true, reason: null }),
  };
}

describe("paramètres", () => {
  it("sont déterministes pour une graine, respectent les plages du niveau et les exclusions", () => {
    const one = chooseParameters(intent.parameters, 1, 42);
    expect(chooseParameters(intent.parameters, 1, 42)).toEqual(one);
    for (let seed = 0; seed < 200; seed++) {
      const p = chooseParameters(intent.parameters, 2, seed);
      expect(p?.a).toBeGreaterThanOrEqual(6);
      expect(p?.b).not.toBe(0);
    }
    expect(seedFrom("eleve:exercice")).toBe(seedFrom("eleve:exercice"));
  });

  it("renvoie null quand une plage ne contient aucune valeur permise", () => {
    expect(
      chooseParameters(
        [{ name: "a", ranges: [{ min: 0, max: 0 }], exclude: [0] }],
        1,
        1,
      ),
    ).toBeNull();
  });
});

describe("renderTemplate", () => {
  it("remplace champs rendus et paramètres, et met les négatifs entre parenthèses", () => {
    expect(
      renderTemplate(
        "{equation} avec {b}",
        { b: -3 },
        { equation: { text: "2x - 3 = 5", latex: "" } },
      ),
    ).toEqual({
      ok: true,
      value: "2x - 3 = 5 avec (-3)",
    });
    expect(renderTemplate("{zz}", {}, {})).toEqual({
      ok: false,
      error: { kind: "unknown_placeholder", name: "zz" },
    });
  });
});

describe("generateVariant", () => {
  it("envoie tous les candidats en un seul appel et garde le premier jeu valide", async () => {
    const calls: number[] = [];
    const result = await generateVariant({
      intent,
      plan: { level: 1, scaffolded: true, hintLevel: 1 },
      seed: 7,
      verifier: fakeVerifier(calls),
    });
    if (!result.ok) throw new Error(result.error.kind);
    const { a = 0, b = 0, c = 0 } = result.value.parameters;
    expect((c - b) % a).toBe(0);
    expect(result.value.statement).toMatch(
      /^Résous l'équation \d+x \+ -?\d+ = \d+\.$/,
    );
    expect(result.value.steps).toHaveLength(2);
    expect(calls).toEqual([30]);
  });

  it("sans guidage, aucune étape n'est montrée", async () => {
    const result = await generateVariant({
      intent,
      plan: { level: 2, scaffolded: false, hintLevel: 1 },
      seed: 3,
      verifier: fakeVerifier(),
    });
    expect(result.ok && result.value.steps).toEqual([]);
  });

  it("n'invente rien quand services/math refuse l'exercice ou ne répond pas", async () => {
    const refusing: MathVerifier = {
      checkExercise: async () =>
        err({ kind: "check_failed", reason: "mismatch" }),
      checkAnswer: async () => ok({ correct: false, reason: null }),
    };
    const down: MathVerifier = {
      checkExercise: async () =>
        err({ kind: "unavailable", message: "connexion refusée" }),
      checkAnswer: async () =>
        err({ kind: "unavailable", message: "connexion refusée" }),
    };
    const plan = { level: 1, scaffolded: false, hintLevel: 0 } as const;
    expect(
      await generateVariant({ intent, plan, seed: 1, verifier: refusing }),
    ).toEqual({
      ok: false,
      error: { kind: "check_failed", reason: "mismatch" },
    });
    expect(
      (await generateVariant({ intent, plan, seed: 1, verifier: down })).ok,
    ).toBe(false);
  });

  it("abandonne après un nombre fini d'essais si les contraintes sont impossibles", async () => {
    const never: MathVerifier = {
      checkExercise: async () =>
        err({ kind: "check_failed", reason: "constraint_failed" }),
      checkAnswer: async () => ok({ correct: false, reason: null }),
    };
    const result = await generateVariant({
      intent,
      plan: { level: 1, scaffolded: false, hintLevel: 0 },
      seed: 1,
      verifier: never,
    });
    expect(result.ok ? null : result.error.kind).toBe("no_valid_parameters");
  });
});

describe("validateIntent", () => {
  it("exige une variante vérifiée à chaque niveau", async () => {
    const result = await validateIntent(intent, fakeVerifier());
    expect(result.ok && result.value.map((v) => v.level)).toEqual([1, 2, 3]);
    const broken = await validateIntent(
      { ...intent, statement: "Résous {inconnu}." },
      fakeVerifier(),
    );
    expect(broken).toEqual({
      ok: false,
      error: { kind: "unknown_placeholder", name: "inconnu", level: 1 },
    });
  });
});
