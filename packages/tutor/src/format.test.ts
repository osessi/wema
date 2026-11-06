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
