import { describe, expect, it } from "vitest";
import {
  CODE_MAX_ATTEMPTS,
  createOneTimeCode,
  createSessionToken,
  generateLoginCode,
  hashToken,
  verifyOneTimeCode,
} from "./index";

const secret = "secret-de-test";
const now = new Date("2026-11-01T10:00:00Z");

describe("jetons de session", () => {
  it("ne stocke que l'empreinte du jeton", () => {
    const { token, tokenHash } = createSessionToken();
    expect(tokenHash).toBe(hashToken(token));
    expect(tokenHash).not.toContain(token);
  });
});

describe("codes à usage unique", () => {
  const issued = createOneTimeCode(secret, now);
  const stored = {
    codeHash: issued.codeHash,
    expiresAt: issued.expiresAt,
    attempts: 1,
    consumedAt: null,
  };

  it("produit 6 chiffres valables 10 minutes", () => {
    expect(issued.code).toMatch(/^\d{6}$/);
    expect(issued.expiresAt.getTime() - now.getTime()).toBe(10 * 60 * 1000);
  });

  it("accepte le bon code", () => {
    expect(verifyOneTimeCode(secret, stored, issued.code, now).ok).toBe(true);
  });

  it("refuse un mauvais code, un code expiré, déjà utilisé, ou après trop d'essais", () => {
    const wrong = issued.code === "000000" ? "111111" : "000000";
    const kind = (r: ReturnType<typeof verifyOneTimeCode>) =>
      r.ok ? "ok" : r.error.kind;
    expect(kind(verifyOneTimeCode(secret, stored, wrong, now))).toBe(
      "code_mismatch",
    );
    expect(
      kind(verifyOneTimeCode(secret, stored, issued.code, issued.expiresAt)),
    ).toBe("code_expired");
    expect(
      kind(
        verifyOneTimeCode(
          secret,
          { ...stored, consumedAt: now },
          issued.code,
          now,
        ),
      ),
    ).toBe("code_used");
    expect(
      kind(
        verifyOneTimeCode(
          secret,
          { ...stored, attempts: CODE_MAX_ATTEMPTS + 1 },
          issued.code,
          now,
        ),
      ),
    ).toBe("too_many_attempts");
  });

  it("un code signé avec un autre secret ne passe pas", () => {
    expect(verifyOneTimeCode("autre-secret", stored, issued.code, now).ok).toBe(
      false,
    );
  });
});

describe("codes de connexion élève", () => {
  it("8 caractères sans ambiguïté (ni 0, O, 1, l, I)", () => {
    for (let i = 0; i < 50; i++)
      expect(generateLoginCode()).toMatch(/^[2-9a-hjkmnp-z]{8}$/);
  });
});
