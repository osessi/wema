import { describe, expect, it } from "vitest";
import {
  checkPasswordRules,
  hashPassword,
  PASSWORD_MAX_CONCURRENT,
  PASSWORD_QUEUE_MAX,
  passwordWorkSaturated,
  verifyPassword,
} from "./index";

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

describe("rafale de connexions", () => {
  it("au-delà de la file d'attente, le serveur se dit saturé au lieu d'empiler des calculs", async () => {
    // Empreinte peu coûteuse (N = 2^10) : on mesure la file, pas scrypt.
    const cheap =
      "scrypt$1024$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    expect(passwordWorkSaturated()).toBe(false);
    const pending = Array.from(
      { length: PASSWORD_MAX_CONCURRENT + PASSWORD_QUEUE_MAX },
      () => verifyPassword("x", cheap),
    );
    expect(passwordWorkSaturated()).toBe(true);
    await Promise.all(pending);
    expect(passwordWorkSaturated()).toBe(false);
  });
});
