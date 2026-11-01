import { describe, expect, it } from "vitest";
import { DEFAULT_BKT, updateMastery } from "./index";

describe("updateMastery (BKT, paramètres par défaut)", () => {
  it("une bonne réponse depuis 0,2 donne 0,6", () => {
    expect(updateMastery(0.2, true, DEFAULT_BKT)).toBeCloseTo(0.6, 6);
  });

  it("une mauvaise réponse depuis 0,2 donne 0,175758", () => {
    expect(updateMastery(0.2, false, DEFAULT_BKT)).toBeCloseTo(0.175758, 6);
  });

  it("une bonne réponse depuis 0,6 donne 0,890323", () => {
    expect(updateMastery(0.6, true, DEFAULT_BKT)).toBeCloseTo(0.890323, 6);
  });
});
