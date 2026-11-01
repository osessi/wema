import type { PGlite, Transaction } from "@electric-sql/pglite";
import type { Pool, PoolClient, QueryResultRow } from "pg";

/** Ce dont le reste du paquet a besoin d'une connexion Postgres. */
export interface SqlExecutor {
  query<T>(sql: string, params?: readonly unknown[]): Promise<{ rows: T[] }>;
  exec(sql: string): Promise<void>;
  /**
   * Exécute `fn` dans une transaction : tout est validé, ou rien. Appelé
   * depuis une transaction, il réutilise la transaction en cours.
   */
  transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T>;
}

function fromPgliteTransaction(tx: Transaction): SqlExecutor {
  const self: SqlExecutor = {
    query: async <T>(sql: string, params: readonly unknown[] = []) => {
      const { rows } = await tx.query<T>(sql, [...params]);
      return { rows };
    },
    exec: async (sql) => {
      await tx.exec(sql);
    },
    transaction: (fn) => fn(self),
  };
  return self;
}

/** Adaptateur pour PGlite (Postgres embarqué, utilisé dans les tests). */
export function fromPglite(db: PGlite): SqlExecutor {
  return {
    query: async <T>(sql: string, params: readonly unknown[] = []) => {
      const { rows } = await db.query<T>(sql, [...params]);
      return { rows };
    },
    exec: async (sql) => {
      await db.exec(sql);
    },
    transaction: (fn) => db.transaction((tx) => fn(fromPgliteTransaction(tx))),
  };
}

function fromPgClient(client: PoolClient): SqlExecutor {
  const self: SqlExecutor = {
    query: async <T>(sql: string, params: readonly unknown[] = []) => {
      const { rows } = await client.query<T & QueryResultRow>(sql, [...params]);
      return { rows };
    },
    exec: async (sql) => {
      await client.query(sql);
    },
    transaction: (fn) => fn(self),
  };
  return self;
}

/** Adaptateur pour un pool `pg` (Postgres en production). */
export function fromPgPool(pool: Pool): SqlExecutor {
  return {
    query: async <T>(sql: string, params: readonly unknown[] = []) => {
      const { rows } = await pool.query<T & QueryResultRow>(sql, [...params]);
      return { rows };
    },
    exec: async (sql) => {
      await pool.query(sql);
    },
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await fn(fromPgClient(client));
        await client.query("COMMIT");
        return result;
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    },
  };
}
