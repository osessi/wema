import { describe, expect, it } from "vitest";
import {
  balanceStep,
  equationOf,
  initialBalance,
  isIsolated,
} from "./balance-state";
import { numberLineTicks, squareOn, triangleLayout } from "./geometry";

describe("balance à équations", () => {
  const start = initialBalance(
    { coefficient: 3, constant: 5 },
    { coefficient: 0, constant: 20 },
  );

  it("chaque geste s'applique aux deux plateaux", () => {
    const removed = balanceStep(start, { type: "remove_units", n: 5 });
    expect(removed.ok).toBe(true);
    expect(equationOf(removed.state, "x")).toBe("3x = 15");
    const divided = balanceStep(removed.state, { type: "divide", n: 3 });
    expect(equationOf(divided.state, "x")).toBe("x = 5");
    expect(isIsolated(divided.state)).toBe(true);
  });

  it("refuse un geste impossible sans rien changer", () => {
    expect(balanceStep(start, { type: "remove_units", n: 6 })).toEqual({
      state: start,
      ok: false,
    });
    // 5 et 20 ne se partagent pas en 3 parts exactes.
    expect(balanceStep(start, { type: "divide", n: 3 }).ok).toBe(false);
    expect(balanceStep(start, { type: "remove_unknowns", n: 1 }).ok).toBe(
      false,
    );
  });

  it("annule et recommence", () => {
    const a = balanceStep(start, { type: "add_units", n: 2 }).state;
    const b = balanceStep(a, { type: "remove_units", n: 4 }).state;
    expect(balanceStep(b, { type: "undo" }).state.left.constant).toBe(7);
    expect(balanceStep(b, { type: "reset" }).state).toEqual(start);
  });
});

describe("géométrie des figures", () => {
  it("triangle rectangle en A, à l'échelle", () => {
    const t = triangleLayout([3, 4], null, 200);
    expect(t.a).toEqual({ x: 0, y: 150 });
    expect(t.b).toEqual({ x: 0, y: 0 });
    expect(t.c).toEqual({ x: 200, y: 150 });
  });

  it("côté cherché : déduit pour le dessin seulement", () => {
    const t = triangleLayout([null, 4], 5, 100);
    expect(t.a.y).toBeCloseTo(75);
  });

  it("carré construit sur un côté", () => {
    expect(squareOn({ x: 0, y: 0 }, { x: 2, y: 0 })).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: -2 },
      { x: 0, y: -2 },
    ]);
  });

  it("droite graduée : départ et arrivée visibles, pas adapté", () => {
    const small = numberLineTicks(2, -7);
    expect(small.min).toBe(-6);
    expect(small.max).toBe(3);
    expect(small.every).toBe(1);
    expect(numberLineTicks(0, 45).every).toBe(5);
  });
});
