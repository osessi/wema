import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { SqlExecutor } from "./executor";

const migrationsDir = fileURLToPath(new URL("../migrations", import.meta.url));

/** Applique dans l'ordre les migrations pas encore passées, chacune dans une transaction. */
export async function migrate(db: SqlExecutor): Promise<void> {
  await db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  const { rows } = await db.query<{ name: string }>(
    "SELECT name FROM schema_migrations",
  );
  const applied = new Set(rows.map((r) => r.name));

  const files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(`${migrationsDir}/${file}`, "utf8");
    await db.exec("BEGIN");
    try {
      await db.exec(sql);
      await db.query("INSERT INTO schema_migrations (name) VALUES ($1)", [
        file,
      ]);
      await db.exec("COMMIT");
    } catch (e) {
      await db.exec("ROLLBACK");
      throw e;
    }
  }
}
