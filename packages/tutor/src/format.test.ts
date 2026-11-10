import { describe, expect, it } from "vitest";
import { dropUnfinishedSentence, finalText, toPlainText } from "./format";

describe("mise en forme des réponses du prof IA", () => {
  it("retire le Markdown et traduit le LaTeX usuel", () => {
    expect(
      toPlainText(
        "**D'abord** : $5^{2} \\times 2$ et $\\sqrt{74}$, puis $\\frac{1}{2}$.\n## Titre\n* point",
      ),
    ).toBe("D'abord : 5² × 2 et √74, puis 1/2.\nTitre\n- point");
    expect(toPlainText("\\(\\sqrt{a+b} \\approx 3\\)")).toBe("√(a+b) ≈ 3");
  });

  it("ne touche pas à une multiplication écrite avec *", () => {
    expect(toPlainText("Calcule 3 * 4 ?")).toBe("Calcule 3 * 4 ?");
  });

  it("écrit un produit 2x ou 2 × x, jamais avec un point", () => {
    expect(toPlainText("On a 2.x + 3 = 7, puis 4.(x + 1).")).toBe(
      "On a 2x + 3 = 7, puis 4(x + 1).",
    );
    expect(toPlainText("Calcule 2·x et 3 ⋅ 4.")).toBe(
      "Calcule 2 × x et 3 × 4.",
    );
    // Un nombre décimal, une fin de phrase ou un mot restent tels quels.
    expect(toPlainText("x = 2.5. Étape 2. x vaut")).toBe(
      "x = 2.5. Étape 2. x vaut",
    );
    expect(toPlainText("version 2.exemple")).toBe("version 2.exemple");
  });

  it("d'une réponse coupée, ne garde que les phrases complètes", () => {
    expect(dropUnfinishedSentence("Bien. Que vaut BC² ? Ensuite tu")).toBe(
      "Bien. Que vaut BC² ?",
    );
    expect(dropUnfinishedSentence("Rien de fini")).toBe("");
    expect(finalText("Phrase entière. Coupée", false)).toBe(
      "Phrase entière. Coupée",
    );
    expect(finalText("Phrase entière. Coupée", true)).toBe("Phrase entière.");
  });
});
