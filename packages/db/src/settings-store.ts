import type { UserId } from "@wema/domain";
import type { SqlExecutor } from "./executor";

/**
 * Réglages stockés en JSON, par clé. La validation de leur contenu revient au
 * paquet qui les définit (ex. `parseLearnerModelSettings`).
 */
export function createSettingsStore(db: SqlExecutor) {
  return {
    async get(key: string): Promise<unknown> {
      const { rows } = await db.query<{ value: unknown }>(
        "SELECT value FROM settings WHERE key = $1",
        [key],
      );
      return rows[0]?.value ?? null;
    },

    async set(
      key: string,
      value: unknown,
      updatedBy: UserId | null,
    ): Promise<void> {
      await db.query(
        `INSERT INTO settings (key, value, updated_by) VALUES ($1, $2::jsonb, $3)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
        [key, JSON.stringify(value), updatedBy],
      );
    },
  };
}

export type SettingsStore = ReturnType<typeof createSettingsStore>;
