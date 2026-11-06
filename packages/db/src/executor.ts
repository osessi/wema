import type { PGlite, Transaction } from "@electric-sql/pglite";
import type { QueryResultRow } from "pg";

/** Ce que l'adaptateur utilise d'une connexion `pg` (PoolClient). */
export interface PgClientLike {
  query<T extends QueryResultRow>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }>;
  /** Avec une erreur, la connexion est fermée au lieu de retourner au pool. */
  release(error?: Error | boolean): void;
}

/** Ce que l'adaptateur utilise d'un pool `pg` (Pool). */
export interface PgPoolLike {
  query<T extends QueryResultRow>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }>;
  connect(): Promise<PgClientLike>;
}

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

function fromPgClient(client: PgClientLike): SqlExecutor {
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
export function fromPgPool(pool: PgPoolLike): SqlExecutor {
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
      let broken: Error | undefined;
      try {
        await client.query("BEGIN");
        const result = await fn(fromPgClient(client));
        await client.query("COMMIT");
        return result;
      } catch (e) {
        // Connexion perdue (Postgres redémarre) : le ROLLBACK échoue aussi. On
        // garde l'erreur d'origine et on écarte la connexion du pool.
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          broken =
            rollbackError instanceof Error
              ? rollbackError
              : new Error("ROLLBACK impossible");
        }
        throw e;
      } finally {
        client.release(broken);
      }
    },
  };
}
