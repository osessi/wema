import { describe, expect, it } from "vitest";
import { checkPasswordRules, hashPassword, verifyPassword } from "./index";

describe("mots de passe", () => {
  it("vérifie le bon mot de passe et refuse un autre", async () => {
    const hash = await hashPassword("cheval-batterie-agrafe");
    expect(hash.startsWith("scrypt$131072$8$1$")).toBe(true);
    expect(await verifyPassword("cheval-batterie-agrafe", hash)).toBe(true);
    expect(await verifyPassword("cheval-batterie-agrafE", hash)).toBe(false);
  });

  it("sale chaque empreinte : deux empreintes du même mot de passe diffèrent", async () => {
    expect(await hashPassword("même mot de passe")).not.toBe(
      await hashPassword("même mot de passe"),
    );
  });

  it("une empreinte illisible ne correspond à rien", async () => {
    expect(await verifyPassword("x", "n'importe quoi")).toBe(false);
  });

  it("impose une longueur minimale", () => {
    expect(checkPasswordRules("court")).toEqual({
      ok: false,
      error: { kind: "password_too_short" },
    });
    expect(checkPasswordRules("assez long pour passer").ok).toBe(true);
  });
});
