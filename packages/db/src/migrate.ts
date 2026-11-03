import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { SqlExecutor } from "./executor";

const migrationsDir = fileURLToPath(new URL("../migrations", import.meta.url));

/**
 * Applique dans l'ordre les migrations pas encore passées, chacune dans une
 * transaction. Un verrou consultatif empêche deux serveurs qui démarrent en
 * même temps d'appliquer la même migration.
 */
export async function migrate(db: SqlExecutor): Promise<void> {
  await db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  const files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const sql = await readFile(`${migrationsDir}/${file}`, "utf8");
    await db.transaction(async (tx) => {
      await tx.query("SELECT pg_advisory_xact_lock(hashtext('wema_migrate'))");
      const { rows } = await tx.query(
        "SELECT 1 FROM schema_migrations WHERE name = $1",
        [file],
      );
      if (rows.length > 0) return;
      await tx.exec(sql);
      await tx.query("INSERT INTO schema_migrations (name) VALUES ($1)", [
        file,
      ]);
    });
  }
}
