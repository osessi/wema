import { describe, expect, it } from "vitest";
import { scrubMessages, scrubPersonalData } from "./index";

describe("masquage des numéros, sans supposer de format national", () => {
  it.each([
    ["+229 01 23 45 67 89", "Bénin, indicatif"],
    ["0033 6 12 34 56 78", "France, 00"],
    ["+1 415 555 0123", "États-Unis"],
    ["06 12 34 56 78", "10 chiffres par paires"],
    ["90 12 34 56", "8 chiffres par paires"],
    ["97.12.34.56", "8 chiffres avec des points"],
    ["07-07-12-34-56", "paires avec des tirets"],
  ])("masque %s (%s)", (phone) => {
    expect(scrubPersonalData(`Appelle-le au ${phone} demain`)).toBe(
      "Appelle-le au [numéro masqué] demain",
    );
  });

  it("masque un numéro annoncé par un mot, même sans séparateurs", () => {
    expect(scrubPersonalData("mon numéro : 612345678")).toBe(
      "mon numéro : [numéro masqué]",
    );
    expect(scrubPersonalData("WhatsApp 77 123 45 67")).toBe(
      "WhatsApp [numéro masqué]",
    );
    expect(scrubPersonalData("mon portable c'est le 0612345678")).toBe(
      "mon portable c'est le [numéro masqué]",
    );
  });

  it("masque les e-mails", () => {
    expect(scrubPersonalData("écris à eleve.test@example.com")).toBe(
      "écris à [e-mail masqué]",
    );
  });

  it.each([
    "Calcule 1 000 000 000 + 2 500 000 000",
    "π vaut environ 3.14159265358",
    "123456789 × 9 = ?",
    "x = 12 345 et y = 0,125",
    "La population est de 13 712 828 habitants.",
    "Résous 3x + 2 = 11",
  ])("ne touche pas aux maths : %s", (text) => {
    expect(scrubPersonalData(text)).toBe(text);
  });

  it("ne filtre que les messages de l'élève", () => {
    const system = {
      role: "system" as const,
      content: "Énoncé : 90 12 34 56 + 1",
    };
    const user = { role: "user" as const, content: "mon tel 90 12 34 56" };
    expect(scrubMessages([system, user])).toEqual([
      system,
      { role: "user", content: "mon tel [numéro masqué]" },
    ]);
  });
});
