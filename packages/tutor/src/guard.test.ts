import type { CanonicalAnswer } from "@wema/domain";
import { err, ok } from "@wema/domain";
import type { MathVerifier } from "@wema/exercises";
import { describe, expect, it } from "vitest";
import { leaksAnswer, normalizeMath, revealsAnswer } from "./index";

const three: CanonicalAnswer = {
  kind: "solutions",
  variable: "x",
  values: ["3"],
};
const negative: CanonicalAnswer = {
  kind: "solutions",
  variable: "x",
  values: ["-4"],
};
const twelve: CanonicalAnswer = { kind: "number", value: "12", decimals: null };
const fortyNine: CanonicalAnswer = {
  kind: "number",
  value: "49",
  decimals: null,
};
const half: CanonicalAnswer = {
  kind: "solutions",
  variable: "x",
  values: ["1/2"],
};
const pair: CanonicalAnswer = {
  kind: "solutions",
  variable: "x",
  values: ["-2", "2"],
};
const pythagore: CanonicalAnswer = {
  kind: "number",
  value: "2*sqrt(13)",
  decimals: 1,
};
const expanded: CanonicalAnswer = {
  kind: "expression",
  value: "3*x + 6",
  form: "expanded",
};
const square: CanonicalAnswer = {
  kind: "expression",
  value: "x**2 + 2*x + 1",
  form: "expanded",
};
const shifted: CanonicalAnswer = {
  kind: "expression",
  value: "6*x - 4",
  form: "expanded",
};

describe("normalizeMath", () => {
  it("unifie apostrophes, nombres en lettres, fractions, racines et LaTeX", () => {
    expect(normalizeMath("Le résultat, c’est trois")).toBe(
      "le résultat, c'est 3",
    );
    expect(normalizeMath("x vaut moins 4")).toBe("x vaut-4");
    expect(normalizeMath("x = ½")).toBe("x=1/2");
    expect(normalizeMath("x = \\frac{1}{2}")).toBe("x=1/2");
    expect(normalizeMath("2 \\sqrt{13}")).toBe("2√13");
    expect(normalizeMath("2√(13)")).toBe("2√13");
    expect(normalizeMath("3x plus 6")).toBe("3x+6");
    expect(normalizeMath("x² + 2x + 1")).toBe("x^2+2x+1");
  });
});

describe("revealsAnswer : la solution est repérée", () => {
  const detected: [string, CanonicalAnswer][] = [
    // Frontière de mot (B1) et apostrophe typographique (B2).
    ["x = 3 donc tu as fini.", three],
    ["x = 3 est la solution, vérifie-le ?", three],
    ["On a x = 3 et c'est juste.", three],
    ["Donc x = 3 si je ne me trompe pas.", three],
    ["Le résultat, c’est 3", three],
    ["Donc x = 3.", three],
    ["on trouve x=−4", negative],
    // Annonces élargies.
    ["Réponse : 3", three],
    ["Résultat final : 3", three],
    ["Tu trouves 3 en divisant.", three],
    ["La valeur de x est 3.", three],
    ["Le nombre cherché est 3.", three],
    ["3 est la solution", three],
    ["S = {3}", three],
    ["Bravo, c'est bien ça : 3 !", three],
    ["Ça fait 12.", twelve],
    ["7 fois 7 font 49.", fortyNine],
    ["Le carré de 7 est 49.", fortyNine],
    // Nombres en lettres.
    ["x vaut trois", three],
    ["x vaut moins 4", negative],
    ["Tu trouves douze", twelve],
    ["x = un demi", half],
    // Fractions, équivalences simples, ±, plusieurs solutions.
    ["x = 9/3", three],
    ["x = 0,5", half],
    ["x = ½", half],
    ["x = \\frac{1}{2}", half],
    ["x = ±2", pair],
    ["les solutions sont 2 et -2", pair],
    // Racines, LaTeX, arrondis.
    ["BC = 2√13", pythagore],
    ["BC = 2√(13)", pythagore],
    ["BC = √52", pythagore],
    ["BC = 2 \\sqrt{13}", pythagore],
    ["BC ≈ 7,2 cm environ, bravo", pythagore],
    ["BC vaut 7,2 cm donc c'est fini", pythagore],
    ["BC ≈ 7.21", pythagore],
    ["c'est 2 racine carrée de 13", pythagore],
    // Expressions, dans n'importe quel ordre.
    ["Tu obtiens 3x + 6, bravo.", expanded],
    ["Ça donne 6 + 3x.", expanded],
    ["Ça fait 3x plus 6", expanded],
    ["Le développement est x^2 + 2x + 1.", square],
    ["Tu obtiens x² + 2x + 1", square],
    ["Donc −4 + 6x", shifted],
  ];
  it.each(detected)("%s", (text, answer) => {
    expect(revealsAnswer(text, answer)).toBe(true);
  });
});

describe("revealsAnswer : une relance n'est pas bloquée", () => {
  const allowed: [string, CanonicalAnswer][] = [
    [
      "Que fais-tu des deux côtés pour isoler x ? Commence par retirer 2.",
      three,
    ],
    ["Regarde l'étape 3 de ton calcul : que vaut 3x ?", three],
    ["Essaie avec x = 30 pour voir si l'égalité tient.", three],
    ["Exemple : si 5x = 10 alors x = 2. À toi avec ton équation ?", three],
    ["Pense à 3 : est-ce que 3×3+2 fait 11 ?", three],
    ["Multiplie 3 par chaque terme de la parenthèse.", expanded],
    ["Écris BC² = 4² + 6². Que vaut 4² ?", pythagore],
    [
      "C'est un nombre entier : lequel ?",
      { kind: "solutions", variable: "x", values: ["1"] },
    ],
  ];
  it.each(allowed)("%s", (text, answer) => {
    expect(revealsAnswer(text, answer)).toBe(false);
  });
});

describe("leaksAnswer", () => {
  it("permet de reprendre une valeur que l'élève a écrite lui-même", async () => {
    const reply = "Tu dis que x = 4. Comment l'as-tu trouvé ?";
    expect(
      await leaksAnswer(reply, [{ ...negative, values: ["4"] }], {
        learnerTexts: ["J'ai trouvé x = 4"],
      }),
    ).toBe(false);
    expect(await leaksAnswer(reply, [{ ...negative, values: ["4"] }])).toBe(
      true,
    );
  });

  it("contrôle toutes les réponses fournies (plusieurs exercices de l'élève)", async () => {
    expect(
      await leaksAnswer("Pour l'autre exercice, x = 12.", [
        three,
        { ...three, values: ["12"] },
      ]),
    ).toBe(true);
  });

  it("soumet les valeurs annoncées à services/math, seul juge de l'équivalence", async () => {
    const seen: string[] = [];
    const verifier: MathVerifier = {
      checkExercise: async () =>
        err({ kind: "unavailable", message: "non utilisé" }),
      checkAnswer: async (_expected, answer) => {
        seen.push(answer);
        return ok({ correct: answer === "6/2", reason: null });
      },
    };
    // 6/2 vaut 3 : le contrôle rapide le voit déjà ; une écriture qu'il ne sait pas lire passe par le vérificateur.
    expect(await leaksAnswer("Donc x = 6/2.", [three], { verifier })).toBe(
      true,
    );
    expect(await leaksAnswer("Donc x = 2(1,5)", [three], { verifier })).toBe(
      false,
    );
    expect(seen).toContain("2(1.5)");
  });

  it("ignore les erreurs du vérificateur et borne le nombre d'appels", async () => {
    let calls = 0;
    const down: MathVerifier = {
      checkExercise: async () => err({ kind: "unavailable", message: "panne" }),
      checkAnswer: async () => {
        calls++;
        return err({ kind: "unavailable", message: "panne" });
      },
    };
    const many = Array.from({ length: 20 }, (_, i) => `y = ${i + 100}`).join(
      ", ",
    );
    expect(await leaksAnswer(many, [three], { verifier: down })).toBe(false);
    expect(calls).toBeLessThanOrEqual(8);
  });
});
