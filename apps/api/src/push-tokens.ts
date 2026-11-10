import type { SqlExecutor } from "@wema/db";
import type { UserId } from "@wema/domain";

/** Appareils gardés au plus par personne (les plus récents). */
export const MAX_PUSH_TOKENS_PER_USER = 10;

export type PushPlatform = "ios" | "android";

/** Forme d'un jeton Expo : `ExponentPushToken[…]` ou `ExpoPushToken[…]`. */
export const EXPO_PUSH_TOKEN = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{1,200}\]$/;

/**
 * Jetons push de l'appli mobile. L'envoi n'est pas ici : le module de
 * notifications (`notify/dispatch.ts`) lit `tokensOf(userId)` pour le canal
 * « app » et appelle le service push d'Expo (`notify/expo.ts`) ; un jeton
 * refusé par Expo (`DeviceNotRegistered`, au ticket ou au reçu) est retiré
 * avec `forget`. Les tickets acceptés attendent leur reçu dans `push_receipts`.
 */
export function createPushTokenStore(db: SqlExecutor) {
  return {
    /** Enregistre (ou rafraîchit) le jeton de l'appareil pour cette personne. */
    async register(
      userId: UserId,
      token: string,
      platform: PushPlatform,
      now: Date,
    ): Promise<void> {
      await db.transaction(async (tx) => {
        await tx.query(
          `INSERT INTO push_tokens (token, user_id, platform, created_at, last_seen_at)
           VALUES ($1, $2, $3, $4, $4)
           ON CONFLICT (token) DO UPDATE
             SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform,
                 last_seen_at = EXCLUDED.last_seen_at`,
          [token, userId, platform, now],
        );
        await tx.query(
          `DELETE FROM push_tokens WHERE user_id = $1 AND token NOT IN (
             SELECT token FROM push_tokens WHERE user_id = $1
             ORDER BY last_seen_at DESC LIMIT $2)`,
          [userId, MAX_PUSH_TOKENS_PER_USER],
        );
      });
    },

    /** Retire un jeton de cette personne (déconnexion, notifications coupées). */
    async remove(userId: UserId, token: string): Promise<void> {
      await db.query(
        "DELETE FROM push_tokens WHERE token = $1 AND user_id = $2",
        [token, userId],
      );
    },

    /** Retire un jeton refusé par le service push (appareil désinstallé). */
    async forget(token: string): Promise<void> {
      await db.query("DELETE FROM push_tokens WHERE token = $1", [token]);
    },

    /** Jetons des appareils de cette personne, du plus récent au plus ancien. */
    async tokensOf(
      userId: UserId,
    ): Promise<{ token: string; platform: PushPlatform }[]> {
      const { rows } = await db.query<{
        token: string;
        platform: PushPlatform;
      }>(
        "SELECT token, platform FROM push_tokens WHERE user_id = $1 ORDER BY last_seen_at DESC",
        [userId],
      );
      return rows;
    },

    /** Garde les tickets acceptés par Expo, pour lire leur reçu plus tard. */
    async saveTickets(
      tickets: { id: string; token: string }[],
      now: Date,
    ): Promise<void> {
      for (const t of tickets)
        await db.query(
          `INSERT INTO push_receipts (ticket_id, token, created_at)
           SELECT $1, $2, $3 WHERE EXISTS (SELECT 1 FROM push_tokens WHERE token = $2)
           ON CONFLICT (ticket_id) DO NOTHING`,
          [t.id, t.token, now],
        );
    },

    /** Tickets dont le reçu doit être prêt (envoyés avant `before`). */
    async ticketsDue(
      before: Date,
      limit: number,
    ): Promise<{ id: string; token: string }[]> {
      const { rows } = await db.query<{ ticket_id: string; token: string }>(
        `SELECT ticket_id, token FROM push_receipts WHERE created_at <= $1
         ORDER BY created_at LIMIT $2`,
        [before, limit],
      );
      return rows.map((r) => ({ id: r.ticket_id, token: r.token }));
    },

    /** Efface des tickets lus, et ceux trop anciens (Expo ne garde pas les reçus). */
    async dropTickets(ids: string[], olderThan: Date): Promise<void> {
      await db.query(
        "DELETE FROM push_receipts WHERE ticket_id = ANY($1::text[]) OR created_at < $2",
        [ids, olderThan],
      );
    },
  };
}
