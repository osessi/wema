import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";
import type { Result } from "@wema/domain";
import { err, ok } from "@wema/domain";

/** Durée d'une session sans activité. */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Durée de vie maximale d'une session, même utilisée chaque jour. */
export const SESSION_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

/** Jeton de session aléatoire ; seule son empreinte est stockée en base. */
export function createSessionToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Codes à usage unique envoyés par SMS ou WhatsApp.
export const CODE_TTL_MS = 10 * 60 * 1000;
export const CODE_MAX_ATTEMPTS = 5;

/**
 * Un code de 6 chiffres se devine hors ligne à partir d'une simple empreinte :
 * on le signe donc avec un secret du serveur (HMAC), absent de la base.
 */
export function hashCode(secret: string, code: string): string {
  return createHmac("sha256", secret).update(code).digest("hex");
}

export function createOneTimeCode(
  secret: string,
  now: Date,
): { code: string; codeHash: string; expiresAt: Date } {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  return {
    code,
    codeHash: hashCode(secret, code),
    expiresAt: new Date(now.getTime() + CODE_TTL_MS),
  };
}

export interface StoredCode {
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  consumedAt: Date | null;
}

export type CodeError = {
  kind: "code_expired" | "code_used" | "too_many_attempts" | "code_mismatch";
};

/**
 * Vérifie un code saisi. L'appelant compte une tentative de plus à chaque
 * appel, réussi ou non, avant d'appeler cette fonction.
 */
export function verifyOneTimeCode(
  secret: string,
  stored: StoredCode,
  input: string,
  now: Date,
): Result<void, CodeError> {
  if (stored.consumedAt !== null) return err({ kind: "code_used" });
  if (now.getTime() >= stored.expiresAt.getTime())
    return err({ kind: "code_expired" });
  if (stored.attempts > CODE_MAX_ATTEMPTS)
    return err({ kind: "too_many_attempts" });
  const expected = Buffer.from(stored.codeHash, "hex");
  const actual = Buffer.from(hashCode(secret, input.trim()), "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual)
    ? ok(undefined)
    : err({ kind: "code_mismatch" });
}

// Caractères sans ambiguïté à l'œil (ni 0/O, ni 1/l/I) : le code est souvent
// recopié par un enfant depuis une feuille donnée par l'école ou le parent.
const LOGIN_CODE_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";

/** Code de connexion d'un compte élève géré par un adulte (8 caractères). */
export function generateLoginCode(): string {
  let code = "";
  for (let i = 0; i < 8; i++)
    code += LOGIN_CODE_ALPHABET[randomInt(0, LOGIN_CODE_ALPHABET.length)];
  return code;
}
