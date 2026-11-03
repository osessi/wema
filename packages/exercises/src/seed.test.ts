import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadExerciseSeed } from "./index";

describe("loadExerciseSeed", () => {
  it("charge les exercices d'exemple du dépôt, pour la France et le Bénin", async () => {
    const result = await loadExerciseSeed(
      fileURLToPath(new URL("../../../content/exercises", import.meta.url)),
    );
    if (!result.ok) throw new Error(JSON.stringify(result.error));
    expect(new Set(result.value.map((e) => e.country))).toEqual(
      new Set(["BJ", "FR"]),
    );
    expect(result.value.filter((e) => e.country === "FR")).toHaveLength(14);
    expect(result.value.filter((e) => e.country === "BJ")).toHaveLength(15);
    expect(
      result.value.find((e) => e.notionCode === "pythagore")?.task,
    ).toEqual({
      kind: "evaluate",
      expression: "sqrt(a**2 + b**2)",
      round: 1,
    });
  });
});
