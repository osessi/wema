import { describe, expect, it } from "vitest";
import { fromPgPool, type PgPoolLike } from "./executor";

/** Faux pool : la connexion tombe pendant la transaction (Postgres redémarre). */
function brokenPool() {
  const released: (Error | boolean | undefined)[] = [];
  const pool: PgPoolLike = {
    query: async () => ({ rows: [] }),
    connect: async () => ({
      query: async (sql: string) => {
        if (sql === "BEGIN") return { rows: [] };
        throw new Error(
          sql === "ROLLBACK" ? "Connection terminated" : "connexion perdue",
        );
      },
      release: (e?: Error | boolean) => {
        released.push(e);
      },
    }),
  };
  return { pool, released };
}

describe("transaction sur un pool pg", () => {
  it("connexion perdue : l'erreur d'origine remonte et la connexion est écartée du pool", async () => {
    const { pool, released } = brokenPool();
    const db = fromPgPool(pool);
    await expect(
      db.transaction((tx) => tx.query("INSERT INTO t VALUES (1)")),
    ).rejects.toThrow("connexion perdue");
    expect(released).toHaveLength(1);
    expect(released[0]).toBeInstanceOf(Error);
  });
});
