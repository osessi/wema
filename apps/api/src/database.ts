import { mkdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { fromPglite, fromPgPool, type SqlExecutor } from "@wema/db";
import pg from "pg";
import type { Config } from "./config";

/**
 * Pool Postgres du serveur. Une connexion inactive coupée par Postgres
 * (redémarrage, bascule, coupure réseau) émet une erreur sur le pool : sans
 * écouteur, elle arrêterait le processus. On la note, et le pool rouvre une
 * connexion à la requête suivante. Une base injoignable fait échouer la
 * requête au bout de 5 s au lieu de la laisser attendre.
 */
export function createPgPool(
  config: Pick<Config, "DATABASE_URL" | "DATABASE_POOL_MAX">,
) {
  const pool = new pg.Pool({
    connectionString: config.DATABASE_URL,
    max: config.DATABASE_POOL_MAX,
    connectionTimeoutMillis: 5000,
  });
  pool.on("error", (e) => {
    // Seulement le type et le message (comme app.onError) : pas de détail Postgres.
    console.error(`Postgres (connexion inactive) : ${e.name} : ${e.message}`);
  });
  return pool;
}

/** Postgres si DATABASE_URL est fourni, sinon une base PGlite locale (développement, sans Docker). */
export async function openDatabase(config: Config): Promise<SqlExecutor> {
  if (config.DATABASE_URL) return fromPgPool(createPgPool(config));
  await mkdir(config.WEMA_PGLITE_DIR, { recursive: true });
  return fromPglite(new PGlite(config.WEMA_PGLITE_DIR));
}
