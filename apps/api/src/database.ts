import { mkdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { fromPglite, fromPgPool, type SqlExecutor } from "@wema/db";
import pg from "pg";
import type { Config } from "./config";

/** Postgres si DATABASE_URL est fourni, sinon une base PGlite locale (développement, sans Docker). */
export async function openDatabase(config: Config): Promise<SqlExecutor> {
  if (config.DATABASE_URL)
    return fromPgPool(new pg.Pool({ connectionString: config.DATABASE_URL }));
  await mkdir(config.WEMA_PGLITE_DIR, { recursive: true });
  return fromPglite(new PGlite(config.WEMA_PGLITE_DIR));
}
