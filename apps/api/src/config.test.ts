import { describe, expect, it } from "vitest";
import { loadConfig } from "./config";

// Valeurs factices, uniquement pour les tests.
const production = {
  NODE_ENV: "production",
  DATABASE_URL: "postgres://wema:essai@postgres:5432/wema",
  WEMA_CODE_SECRET: "x".repeat(48),
  WEMA_HEALTH_KEY: Buffer.alloc(32, 7).toString("base64"),
  WEMA_PUBLIC_URL: "https://wema.example",
};

const errorOf = (env: Record<string, string | undefined>) => {
  const result = loadConfig(env);
  return result.ok ? null : result.error.message;
};

describe("configuration", () => {
  it("en développement, tout a une valeur par défaut et le planificateur est interne", () => {
    const result = loadConfig({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.production).toBe(false);
    expect(result.value.scheduler).toBe("interne");
    expect(result.value.healthKey.length).toBe(32);
  });

  it("les pages de l'application sont sous /app de l'origine publique, sauf réglage", () => {
    const result = loadConfig({ WEMA_PUBLIC_URL: "https://wema.example/" });
    expect(result.ok && result.value.appUrl).toBe("https://wema.example/app");
    const bare = loadConfig({
      WEMA_PUBLIC_URL: "https://wema.example",
      WEMA_APP_PATH: "",
    });
    expect(bare.ok && bare.value.appUrl).toBe("https://wema.example");
    expect(errorOf({ WEMA_APP_PATH: "app" })).toContain("WEMA_APP_PATH");
  });

  it("avec un Postgres, le planificateur est pg-boss", () => {
    const result = loadConfig({
      DATABASE_URL: "postgres://wema:wema@localhost:5432/wema",
    });
    expect(result.ok && result.value.scheduler).toBe("pg-boss");
  });

  it("une configuration de production complète passe", () => {
    const result = loadConfig(production);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.production).toBe(true);
    expect(result.value.scheduler).toBe("pg-boss");
    expect(result.value.codeSecret).toBe(production.WEMA_CODE_SECRET);
  });

  it("en production, chaque secret manquant est signalé", () => {
    const message = errorOf({ NODE_ENV: "production" });
    expect(message).toContain("DATABASE_URL est obligatoire");
    expect(message).toContain("WEMA_CODE_SECRET est obligatoire");
    expect(message).toContain("WEMA_HEALTH_KEY est obligatoire");
    expect(message).toContain("WEMA_PUBLIC_URL");
  });

  it.each([
    ["WEMA_PUBLIC_URL", "http://wema.example"],
    ["WEMA_PUBLIC_URL", "https://localhost:3000"],
    ["WEMA_CODE_SECRET", "trop-court"],
    ["DATABASE_URL", "mysql://wema@db/wema"],
    ["WEMA_SUPER_ADMIN_PASSWORD", "court"],
  ])("en production, %s = %s est refusé", (key, value) => {
    const message = errorOf({ ...production, [key]: value });
    expect(message).toContain(key);
  });

  it("les messages d'erreur ne recopient jamais les valeurs", () => {
    const secret = "secret-trop-court";
    const message = errorOf({ ...production, WEMA_CODE_SECRET: secret });
    expect(message).not.toContain(secret);
  });

  it("une clé de santé qui ne fait pas 32 octets est refusée", () => {
    const message = errorOf({
      ...production,
      WEMA_HEALTH_KEY: Buffer.alloc(16).toString("base64"),
    });
    expect(message).toContain("32 octets");
  });
});
