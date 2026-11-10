import { describe, expect, it } from "vitest";
import { loadConfig } from "./config";
import { createPgPool } from "./database";
import { ADMIN, browser, field, testServer } from "./test-helpers";

describe("pool Postgres", () => {
  it("une connexion inactive coupée par Postgres (redémarrage, panne) ne fait pas tomber l'API", async () => {
    const config = loadConfig({
      DATABASE_URL: "postgres://wema:essai@localhost:5999/wema",
    });
    if (!config.ok) throw new Error(config.error.message);
    const pool = createPgPool(config.value);
    const logged: unknown[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => logged.push(args.join(" "));
    try {
      // Sans écouteur, `pg` relance l'erreur et le processus s'arrête.
      expect(() =>
        pool.emit(
          "error",
          new Error("terminating connection due to administrator command"),
        ),
      ).not.toThrow();
    } finally {
      console.error = original;
    }
    expect(logged).toHaveLength(1);
    expect(pool.options.max).toBe(20);
    expect(pool.options.connectionTimeoutMillis).toBe(5000);
    await pool.end();
  });

  it("taille du pool réglable par DATABASE_POOL_MAX", () => {
    const config = loadConfig({
      DATABASE_URL: "postgres://wema:essai@localhost:5999/wema",
      DATABASE_POOL_MAX: "40",
    });
    expect(config.ok && config.value.DATABASE_POOL_MAX).toBe(40);
    expect(loadConfig({ DATABASE_POOL_MAX: "0" }).ok).toBe(false);
  });
});

describe("base injoignable", () => {
  it("une connexion Postgres perdue répond 503 service_unavailable (réessayer), pas une erreur interne", async () => {
    const server = await testServer();
    const b = browser(server.app);
    await b.post("/auth/login", ADMIN);
    const original = console.error;
    console.error = () => {};
    try {
      for (const failure of [
        Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:5432"), {
          code: "ECONNREFUSED",
        }),
        new Error("Connection terminated unexpectedly"),
        new Error("timeout exceeded when trying to connect"),
        Object.assign(new Error("terminating connection"), { code: "57P01" }),
      ]) {
        server.db.query = async () => {
          throw failure;
        };
        const res = await b.get("/auth/me");
        expect(res.status).toBe(503);
        expect(field(res.json, "error", "code")).toBe("service_unavailable");
        expect(res.headers.get("retry-after")).toBe("5");
      }
      // Une vraie erreur de programme reste une erreur interne.
      server.db.query = async () => {
        throw new Error("colonne inconnue");
      };
      expect((await b.get("/auth/me")).status).toBe(500);
    } finally {
      console.error = original;
    }
  });
});
