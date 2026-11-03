import { createHash } from "node:crypto";
import { z } from "zod";

const optional = z
  .string()
  .optional()
  .transform((v) => (v === undefined || v.trim() === "" ? undefined : v));

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  /** Postgres. Absent en développement : base PGlite locale dans WEMA_PGLITE_DIR. */
  DATABASE_URL: optional,
  WEMA_PGLITE_DIR: z.string().default(".data/pglite"),
  /** Secret qui signe les codes envoyés par téléphone. Obligatoire en production. */
  WEMA_CODE_SECRET: optional,
  /** Adresse publique du web (retours de Google et d'Apple, origine autorisée). */
  WEMA_PUBLIC_URL: z.url().default("http://localhost:3000"),
  /** Adresse de services/math (vérification des exercices). */
  WEMA_MATH_URL: z.url().default("http://localhost:8000"),
  /** Clé de chiffrement des données de santé (32 octets en base64). Obligatoire en production. */
  WEMA_HEALTH_KEY: optional,
  /** Clé OpenRouter (passerelle IA). Sans elle, l'IA n'est pas disponible. */
  OPENROUTER_API_KEY: optional,
  WEMA_SUPER_ADMIN_EMAIL: optional,
  WEMA_SUPER_ADMIN_PASSWORD: optional,
  WEMA_SUPER_ADMIN_NAME: z.string().default("Super admin"),
  GOOGLE_CLIENT_ID: optional,
  GOOGLE_CLIENT_SECRET: optional,
  APPLE_CLIENT_ID: optional,
  APPLE_TEAM_ID: optional,
  APPLE_KEY_ID: optional,
  APPLE_PRIVATE_KEY: optional,
});

export type Config = z.infer<typeof envSchema> & {
  production: boolean;
  codeSecret: string;
  healthKey: Buffer;
};

export type ConfigError = { kind: "invalid_config"; message: string };

/** Lit et vérifie la configuration ; en production, les secrets sont exigés. */
export function loadConfig(
  env: NodeJS.ProcessEnv,
): { ok: true; value: Config } | { ok: false; error: ConfigError } {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success)
    return {
      ok: false,
      error: { kind: "invalid_config", message: z.prettifyError(parsed.error) },
    };
  const c = parsed.data;
  const production = c.NODE_ENV === "production";
  const healthKey = c.WEMA_HEALTH_KEY
    ? Buffer.from(c.WEMA_HEALTH_KEY, "base64")
    : // En développement seulement : clé dérivée d'un secret local.
      createHash("sha256")
        .update(`wema-sante:${c.WEMA_CODE_SECRET ?? "developpement"}`)
        .digest();
  if (healthKey.length !== 32) {
    return {
      ok: false,
      error: {
        kind: "invalid_config",
        message: "WEMA_HEALTH_KEY doit faire 32 octets (en base64).",
      },
    };
  }
  if (
    production &&
    (!c.DATABASE_URL || !c.WEMA_CODE_SECRET || !c.WEMA_HEALTH_KEY)
  ) {
    return {
      ok: false,
      error: {
        kind: "invalid_config",
        message:
          "DATABASE_URL, WEMA_CODE_SECRET et WEMA_HEALTH_KEY sont obligatoires en production.",
      },
    };
  }
  return {
    ok: true,
    value: {
      ...c,
      production,
      codeSecret: c.WEMA_CODE_SECRET ?? "secret-de-developpement-seulement",
      healthKey,
    },
  };
}
