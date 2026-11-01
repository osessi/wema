import { asMisconceptionId } from "@wema/domain";
import { describe, expect, it } from "vitest";
import { evaluateReply, type TutorContext } from "./index";

const ctx: TutorContext = {
  mode: "exercise_help",
  subjectName: "Mathématiques",
  subjectInstructions: "",
  notion: { name: "Équations", description: "" },
  misconceptions: [{ id: asMisconceptionId("m"), description: "" }],
  learner: { status: "needs_work", activeMisconceptions: [] },
  exercise: {
    statement: "Résous 3x + 2 = 11.",
    steps: [],
    answer: { kind: "solutions", variable: "x", values: ["3"] },
  },
  hintLevel: 0,
};

const failed = (text: string) =>
  evaluateReply(text, ctx)
    .filter((c) => !c.passed)
    .map((c) => c.id);

describe("critères du banc d'essai", () => {
  it("une bonne relance passe tous les critères", () => {
    expect(
      failed(
        "Bonne idée de commencer ! Que fais-tu pour enlever le 2 dans les deux membres ?",
      ),
    ).toEqual([]);
  });

  it("repère la réponse donnée, une donnée personnelle, l'anglais et l'absence de question", () => {
    expect(failed("Donc x = 3.")).toEqual(["no_final_answer", "asks_question"]);
    expect(failed("Je t'appelle au +33 6 12 34 56 78 ?")).toContain(
      "no_personal_data",
    );
    expect(failed("What do you think is the first step for this?")).toContain(
      "french",
    );
  });
});
