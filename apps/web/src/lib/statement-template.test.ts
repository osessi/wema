import { describe, expect, it } from "vitest";
import { readableMath, templatePreview } from "./statement-template";

describe("templatePreview", () => {
  it("remplace un champ de la tâche par son écriture lisible", () => {
    expect(
      templatePreview("Développe l'expression {expression}.", {
        kind: "expand",
        expression: "k*(x + a)",
      }),
    ).toBe("Développe l'expression k(x + a).");
  });

  it("laisse les paramètres sous forme de lettres", () => {
    expect(templatePreview("Divise par {a}.", { kind: "solve" })).toBe(
      "Divise par a.",
    );
  });

  it("écrit les puissances et les produits", () => {
    expect(readableMath("a**2")).toBe("a²");
    expect(readableMath("(x + a)*(x + b)")).toBe("(x + a)(x + b)");
    expect(readableMath("a*b")).toBe("a × b");
    expect(readableMath("3*x")).toBe("3x");
  });
});
