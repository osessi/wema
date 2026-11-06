import { fileURLToPath } from "node:url";
import { ADMIN, DEMO_PASSWORD } from "./env";

/** Comptes fictifs du jeu de démonstration (apps/api/src/seed-demo.ts). */
export const ACCOUNTS = {
  admin: ADMIN,
  direction: { email: "direction@wema.test", password: DEMO_PASSWORD },
  prof: { email: "prof@wema.test", password: DEMO_PASSWORD },
  eleve1: { email: "eleve1@wema.test", password: DEMO_PASSWORD },
  eleve2: { email: "eleve2@wema.test", password: DEMO_PASSWORD },
  eleve3: { email: "eleve3@wema.test", password: DEMO_PASSWORD },
  parent: { email: "parent@wema.test", password: DEMO_PASSWORD },
} as const;

export type AccountName = keyof typeof ACCOUNTS;
export const ACCOUNT_NAMES: readonly AccountName[] = [
  "admin",
  "direction",
  "prof",
  "eleve1",
  "eleve2",
  "eleve3",
  "parent",
];

/** Session enregistrée par global-setup.ts pour ce compte. */
export function authFile(name: AccountName): string {
  return fileURLToPath(new URL(`./.auth/${name}.json`, import.meta.url));
}
