import { describe, expect, it } from "vitest";
import { normalizeEmail, normalizePhone, normalizeUsername } from "./index";

describe("identifiants de connexion", () => {
  it("normalise un e-mail et refuse un e-mail invalide", () => {
    expect(normalizeEmail("  Prof.Exemple@Example.COM ")).toEqual({
      ok: true,
      value: "prof.exemple@example.com",
    });
    expect(normalizeEmail("pas-un-email").ok).toBe(false);
  });

  it("accepte un numéro international et retire les espaces", () => {
    expect(normalizePhone("+33 6 00 00 00 00")).toEqual({
      ok: true,
      value: "+33600000000",
    });
    expect(normalizePhone("0600000000").ok).toBe(false);
  });

  it("normalise un identifiant élève", () => {
    expect(normalizeUsername("Eleve.Test-3")).toEqual({
      ok: true,
      value: "eleve.test-3",
    });
    expect(normalizeUsername("a").ok).toBe(false);
  });
});
