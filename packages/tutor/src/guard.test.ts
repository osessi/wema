import { describe, expect, it } from "vitest";
import { revealsAnswer } from "./index";

const solution = { kind: "solutions" as const, variable: "x", values: ["3"] };
const negative = { kind: "solutions" as const, variable: "x", values: ["-4"] };
const expanded = {
  kind: "expression" as const,
  value: "3*x + 6",
  form: "expanded" as const,
};
const pythagore = { kind: "number" as const, value: "2*sqrt(13)", decimals: 1 };

describe("revealsAnswer", () => {
  it("repère une solution donnée, quelle que soit l'écriture", () => {
    expect(revealsAnswer("Donc x = 3.", solution)).toBe(true);
    expect(revealsAnswer("La réponse est 3 !", solution)).toBe(true);
    expect(revealsAnswer("on trouve x=−4", negative)).toBe(true);
  });

  it("laisse passer une relance qui ne donne pas la solution", () => {
    expect(
      revealsAnswer(
        "Que fais-tu des deux côtés pour isoler x ? Commence par retirer 2.",
        solution,
      ),
    ).toBe(false);
    expect(
      revealsAnswer(
        "Regarde l'étape 3 de ton calcul : que vaut 3x ?",
        solution,
      ),
    ).toBe(false);
    expect(
      revealsAnswer(
        "Essaie avec x = 30 pour voir si l'égalité tient.",
        solution,
      ),
    ).toBe(false);
  });

  it("repère une forme développée recopiée", () => {
    expect(revealsAnswer("Tu obtiens 3x + 6, bravo.", expanded)).toBe(true);
    expect(
      revealsAnswer("Multiplie 3 par chaque terme de la parenthèse.", expanded),
    ).toBe(false);
  });

  it("repère une valeur exacte ou arrondie annoncée", () => {
    expect(revealsAnswer("BC = 2√13", pythagore)).toBe(true);
    expect(
      revealsAnswer(
        "BC vaut racine de 52, donc environ… non : c'est 2 racine carrée de 13",
        pythagore,
      ),
    ).toBe(true);
    expect(revealsAnswer("BC ≈ 7,2 cm", pythagore)).toBe(true);
    expect(revealsAnswer("Écris BC² = 4² + 6². Que vaut 4² ?", pythagore)).toBe(
      false,
    );
  });
});
