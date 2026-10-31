import type { PGlite } from "@electric-sql/pglite";

/** Ce dont le reste du paquet a besoin d'une connexion Postgres. */
export interface SqlExecutor {
  query<T>(sql: string, params?: readonly unknown[]): Promise<{ rows: T[] }>;
  exec(sql: string): Promise<void>;
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
  };
}
