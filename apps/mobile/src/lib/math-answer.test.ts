import { describe, expect, it } from "vitest";
import { eraseAt, insertAt, MATH_KEYS, toAnswerText } from "./math-answer";

const key = (label: string) => {
  const found = MATH_KEYS.flat().find((k) => k.label === label);
  if (!found) throw new Error(`touche ${label} absente`);
  return found;
};

describe("réponse au format de services/math", () => {
  it("traduit les symboles des touches", () => {
    expect(toAnswerText("x = 3")).toBe("x = 3");
    expect(toAnswerText("2 × x − 4 ÷ 2")).toBe("2 * x - 4 / 2");
    expect(toAnswerText("√(2)")).toBe("sqrt(2)");
    expect(toAnswerText("√2")).toBe("sqrt(2)");
    expect(toAnswerText("x²")).toBe("x^2");
    expect(toAnswerText("(7)/(2)")).toBe("(7)/(2)");
    expect(toAnswerText("  x = 3   ou   x = −2 ")).toBe("x = 3 ou x = -2");
    expect(toAnswerText("8,6")).toBe("8,6");
  });
});

describe("clavier mathématique", () => {
  it("insère au curseur et se place dans les parenthèses", () => {
    const sqrt = insertAt("2", { start: 1, end: 1 }, key("√"));
    expect(sqrt).toEqual({ value: "2√()", cursor: 3 });
    const frac = insertAt("", { start: 0, end: 0 }, key("a/b"));
    expect(frac).toEqual({ value: "()/()", cursor: 1 });
    expect(insertAt("x3", { start: 1, end: 1 }, key("="))).toEqual({
      value: "x = 3",
      cursor: 4,
    });
  });

  it("remplace la sélection et efface", () => {
    expect(insertAt("abc", { start: 0, end: 3 }, key("x")).value).toBe("x");
    expect(eraseAt("x=3", { start: 3, end: 3 })).toEqual({
      value: "x=",
      cursor: 2,
    });
    expect(eraseAt("x=3", { start: 0, end: 0 })).toEqual({
      value: "x=3",
      cursor: 0,
    });
    expect(eraseAt("x=3", { start: 0, end: 2 })).toEqual({
      value: "3",
      cursor: 0,
    });
  });
});
