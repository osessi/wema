import type { Result } from "@wema/domain";
import { err, ok } from "@wema/domain";

export type IdentifierError = {
  kind: "invalid_email" | "invalid_phone" | "invalid_username";
};

export function normalizeEmail(input: string): Result<string, IdentifierError> {
  const email = input.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254
    ? ok(email)
    : err({ kind: "invalid_email" });
}

/** Numéro au format international E.164 (+ indicatif pays, sans espaces). */
export function normalizePhone(input: string): Result<string, IdentifierError> {
  const phone = input.replace(/[\s.()-]/g, "");
  return /^\+[1-9]\d{6,14}$/.test(phone)
    ? ok(phone)
    : err({ kind: "invalid_phone" });
}

/** Identifiant d'un compte élève : 3 à 32 caractères, lettres, chiffres, point, tiret. */
export function normalizeUsername(
  input: string,
): Result<string, IdentifierError> {
  const username = input.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)
    ? ok(username)
    : err({ kind: "invalid_username" });
}
