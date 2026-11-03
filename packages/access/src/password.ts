import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { Result } from "@wema/domain";
import { err, ok } from "@wema/domain";

// Paramètres scrypt recommandés par l'OWASP (N = 2^17, r = 8, p = 1). Ils sont
// enregistrés avec chaque empreinte : on peut les durcir sans casser les
// mots de passe existants.
const N = 2 ** 17;
const R = 8;
const P = 1;
const KEY_LENGTH = 32;

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 200;

export type PasswordError = {
  kind: "password_too_short" | "password_too_long";
};

/** Règles minimales d'un mot de passe : la longueur, pas la complexité imposée. */
export function checkPasswordRules(
  password: string,
): Result<void, PasswordError> {
  if (password.length < PASSWORD_MIN_LENGTH)
    return err({ kind: "password_too_short" });
  if (password.length > PASSWORD_MAX_LENGTH)
    return err({ kind: "password_too_long" });
  return ok(undefined);
}

// Chaque calcul scrypt mobilise environ 128 Mo : on en limite le nombre
// simultané pour qu'une rafale de connexions ne sature pas le serveur.
const MAX_CONCURRENT = 4;
let running = 0;
const waiting: (() => void)[] = [];

async function limited<T>(fn: () => Promise<T>): Promise<T> {
  if (running >= MAX_CONCURRENT)
    await new Promise<void>((resolve) => waiting.push(resolve));
  running++;
  try {
    return await fn();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

function derive(
  password: string,
  salt: Buffer,
  n: number,
  r: number,
  p: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize("NFKC"),
      salt,
      KEY_LENGTH,
      { N: n, r, p, maxmem: 256 * n * r },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
}

/** Empreinte au format `scrypt$N$r$p$sel$clé` (base64url). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await limited(() => derive(password, salt, N, R, P));
  return [
    "scrypt",
    N,
    R,
    P,
    salt.toString("base64url"),
    key.toString("base64url"),
  ].join("$");
}

/** Comparaison en temps constant ; une empreinte illisible ne correspond à rien. */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [algo, n, r, p, salt, key] = stored.split("$");
  if (algo !== "scrypt" || !n || !r || !p || !salt || !key) return false;
  const expected = Buffer.from(key, "base64url");
  const actual = await limited(() =>
    derive(
      password,
      Buffer.from(salt, "base64url"),
      Number(n),
      Number(r),
      Number(p),
    ),
  );
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
