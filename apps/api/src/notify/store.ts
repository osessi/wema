import { randomUUID } from "node:crypto";
import type { SqlExecutor } from "@wema/db";
import {
  type ChannelChoice,
  DEFAULT_QUIET,
  type DeliveryKind,
  type NotifyChannel,
} from "./rules";

/**
 * Accès SQL des envois (migration 0017) : préférences, journal des envois,
 * et lectures dont les passages ont besoin (destinataires, messages non lus).
 */

export interface NotificationPreferences {
  timeZone: string | null;
  quietStart: number;
  quietEnd: number;
  nudgeChannel: ChannelChoice;
  messageChannel: ChannelChoice;
}

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  timeZone: null,
  quietStart: DEFAULT_QUIET.start,
  quietEnd: DEFAULT_QUIET.end,
  nudgeChannel: "app",
  messageChannel: "app",
};

export type DeliveryStatus = "pending" | "sent" | "failed" | "cancelled";

export interface Delivery {
  id: string;
  userId: string;
  kind: DeliveryKind;
  channel: NotifyChannel;
  status: DeliveryStatus;
  nudgeId: string | null;
  sessionId: string | null;
  reminder: "24h" | "1h" | null;
  /** Page du web à ouvrir (chemin) ; null : l'accueil. */
  linkPath: string | null;
  messageCount: number | null;
  subject: string | null;
  body: string;
  attempts: number;
  lastError: string | null;
  notBefore: Date;
  createdAt: Date;
  sentAt: Date | null;
}

interface DeliveryRow {
  id: string;
  user_id: string;
  kind: DeliveryKind;
  channel: NotifyChannel;
  status: DeliveryStatus;
  nudge_id: string | null;
  session_id: string | null;
  reminder: "24h" | "1h" | null;
  link_path: string | null;
  message_count: number | null;
  subject: string | null;
  body: string;
  attempts: number;
  last_error: string | null;
  not_before: Date;
  created_at: Date;
  sent_at: Date | null;
}

const toDelivery = (r: DeliveryRow): Delivery => ({
  id: r.id,
  userId: r.user_id,
  kind: r.kind,
  channel: r.channel,
  status: r.status,
  nudgeId: r.nudge_id,
  sessionId: r.session_id,
  reminder: r.reminder,
  linkPath: r.link_path,
  messageCount: r.message_count,
  subject: r.subject,
  body: r.body,
  attempts: r.attempts,
  lastError: r.last_error,
  notBefore: r.not_before,
  createdAt: r.created_at,
  sentAt: r.sent_at,
});

const DELIVERY_COLUMNS =
  "id, user_id, kind, channel, status, nudge_id, session_id, reminder, link_path, message_count, subject, body, attempts, last_error, not_before, created_at, sent_at";

/** Appartenance encore valable à une classe active (comme la messagerie). */
const ACTIVE_MEMBERS = `SELECT m.class_id, m.user_id, m.role
  FROM class_members m JOIN classes c ON c.id = m.class_id
  WHERE c.archived_at IS NULL
    AND EXISTS (SELECT 1 FROM memberships o WHERE o.organization_id = c.organization_id AND o.user_id = m.user_id)`;

/** Lien parent ↔ enfant encore valable (les deux sont membres de la famille). */
const VALID_GUARDIANSHIPS = `SELECT g.guardian_id, g.learner_id FROM guardianships g
  WHERE EXISTS (SELECT 1 FROM memberships o WHERE o.organization_id = g.organization_id AND o.user_id = g.guardian_id)
    AND EXISTS (SELECT 1 FROM memberships o WHERE o.organization_id = g.organization_id AND o.user_id = g.learner_id)`;

export interface NudgeRecipient {
  nudgeId: string;
  userId: string;
  recipient: "learner" | "guardian";
  nudgeText: string;
  childName: string;
  channel: NotifyChannel;
}

export function createNotificationStore(db: SqlExecutor) {
  const store = {
    async preferences(userId: string): Promise<NotificationPreferences> {
      const { rows } = await db.query<{
        time_zone: string | null;
        quiet_start: number;
        quiet_end: number;
        nudge_channel: ChannelChoice;
        message_channel: ChannelChoice;
      }>(
        "SELECT time_zone, quiet_start, quiet_end, nudge_channel, message_channel FROM notification_preferences WHERE user_id = $1",
        [userId],
      );
      const r = rows[0];
      return r
        ? {
            timeZone: r.time_zone,
            quietStart: r.quiet_start,
            quietEnd: r.quiet_end,
            nudgeChannel: r.nudge_channel,
            messageChannel: r.message_channel,
          }
        : { ...DEFAULT_PREFERENCES };
    },

    async savePreferences(
      userId: string,
      patch: {
        [K in keyof NotificationPreferences]?:
          | NotificationPreferences[K]
          | undefined;
      },
      now: Date,
    ): Promise<NotificationPreferences> {
      const current = await store.preferences(userId);
      const next: NotificationPreferences = {
        timeZone:
          patch.timeZone === undefined ? current.timeZone : patch.timeZone,
        quietStart: patch.quietStart ?? current.quietStart,
        quietEnd: patch.quietEnd ?? current.quietEnd,
        nudgeChannel: patch.nudgeChannel ?? current.nudgeChannel,
        messageChannel: patch.messageChannel ?? current.messageChannel,
      };
      await db.query(
        `INSERT INTO notification_preferences
           (user_id, time_zone, quiet_start, quiet_end, nudge_channel, message_channel, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (user_id) DO UPDATE SET time_zone = EXCLUDED.time_zone,
           quiet_start = EXCLUDED.quiet_start, quiet_end = EXCLUDED.quiet_end,
           nudge_channel = EXCLUDED.nudge_channel, message_channel = EXCLUDED.message_channel,
           updated_at = EXCLUDED.updated_at`,
        [
          userId,
          next.timeZone,
          next.quietStart,
          next.quietEnd,
          next.nudgeChannel,
          next.messageChannel,
          now.toISOString(),
        ],
      );
      return next;
    },

    /** Adresses de la personne : e-mail de connexion, téléphone vérifié. */
    async addresses(
      userId: string,
    ): Promise<{ email: string | null; phone: string | null }> {
      const { rows } = await db.query<{ kind: string; identifier: string }>(
        `SELECT kind, identifier FROM identities
         WHERE user_id = $1 AND (kind = 'email' OR (kind = 'phone' AND verified_at IS NOT NULL))
         ORDER BY created_at`,
        [userId],
      );
      return {
        email: rows.find((r) => r.kind === "email")?.identifier ?? null,
        phone: rows.find((r) => r.kind === "phone")?.identifier ?? null,
      };
    },

    /**
     * Compte d'élève : inscrit comme élève dans une classe, suivi par un parent,
     * ou avec un journal d'apprentissage. On le traite
     * alors comme un mineur (tutoiement, aucun contenu commercial).
     */
    async isLearner(userId: string): Promise<boolean> {
      const { rows } = await db.query<{ learner: boolean }>(
        `SELECT EXISTS (SELECT 1 FROM class_members WHERE user_id = $1 AND role = 'learner')
             OR EXISTS (SELECT 1 FROM guardianships WHERE learner_id = $1)
             OR EXISTS (SELECT 1 FROM learning_events WHERE learner_id = $1) AS learner`,
        [userId],
      );
      return rows[0]?.learner === true;
    },

    /** Vrai si la personne suit au moins un enfant (lien valable). */
    async isGuardian(userId: string): Promise<boolean> {
      const { rows } = await db.query(
        `SELECT 1 FROM (${VALID_GUARDIANSHIPS}) vg WHERE vg.guardian_id = $1 LIMIT 1`,
        [userId],
      );
      return rows.length > 0;
    },

    /** Messages non lus de la personne, tous fils confondus (route légère du menu). */
    async unreadMessages(userId: string): Promise<number> {
      const { rows } = await db.query<{ n: number }>(
        `WITH mine AS (
           SELECT p.conversation_id AS id FROM conversation_participants p WHERE p.user_id = $1
           UNION
           SELECT cv.id FROM conversations cv JOIN (${ACTIVE_MEMBERS}) am ON am.class_id = cv.class_id AND am.user_id = $1
         )
         SELECT count(*)::int AS n FROM mine
         JOIN messages m ON m.conversation_id = mine.id
         LEFT JOIN conversation_reads r ON r.conversation_id = mine.id AND r.user_id = $1
         WHERE m.sender_id IS DISTINCT FROM $1
           AND m.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz)`,
        [userId],
      );
      return rows[0]?.n ?? 0;
    },

    /**
     * Relances récentes encore non lues, et chaque personne à prévenir (l'élève
     * et ses parents) qui n'a pas encore sa notification et ne l'a pas coupée.
     */
    async nudgeRecipients(since: Date): Promise<NudgeRecipient[]> {
      const { rows } = await db.query<{
        nudge_id: string;
        user_id: string;
        recipient: "learner" | "guardian";
        content: string;
        child_name: string;
        channel: NotifyChannel;
      }>(
        `WITH vg AS (${VALID_GUARDIANSHIPS}),
         recent AS (
           SELECT n.id, n.learner_id, n.content, u.display_name
           FROM nudges n JOIN users u ON u.id = n.learner_id
           WHERE n.status = 'ready' AND n.created_at > $1 AND u.disabled_at IS NULL
         ),
         recipients AS (
           SELECT r.id AS nudge_id, r.learner_id AS user_id, 'learner' AS recipient, r.content, r.display_name AS child_name
           FROM recent r
           UNION
           SELECT r.id, g.guardian_id, 'guardian', r.content, r.display_name
           FROM recent r JOIN vg g ON g.learner_id = r.learner_id
         )
         SELECT x.nudge_id, x.user_id, x.recipient, x.content, x.child_name,
           coalesce(p.nudge_channel, 'app') AS channel
         FROM recipients x
         JOIN users ru ON ru.id = x.user_id AND ru.disabled_at IS NULL
         LEFT JOIN notification_preferences p ON p.user_id = x.user_id
         WHERE coalesce(p.nudge_channel, 'app') <> 'off'
           AND NOT EXISTS (SELECT 1 FROM notification_deliveries d
                           WHERE d.nudge_id = x.nudge_id AND d.user_id = x.user_id)
         ORDER BY x.nudge_id, x.user_id`,
        [since.toISOString()],
      );
      return rows.map((r) => ({
        nudgeId: r.nudge_id,
        userId: r.user_id,
        recipient: r.recipient,
        nudgeText: r.content,
        childName: r.child_name,
        channel: r.channel,
      }));
    },

    /**
     * Personnes à prévenir de nouveaux messages, regroupés : messages non lus,
     * pas encore couverts par une notification, dont le plus ancien attend
     * depuis `oldestBefore`, et pas d'autre notification depuis `lastBefore`.
     * Seulement celles qui ont choisi un canal hors de l'application, ou
     * l'application avec au moins un appareil enregistré (notification push).
     */
    async messageDigestCandidates(input: {
      since: Date;
      oldestBefore: Date;
      lastBefore: Date;
    }): Promise<
      {
        userId: string;
        count: number;
        newest: Date;
        channel: NotifyChannel;
      }[]
    > {
      const { rows } = await db.query<{
        user_id: string;
        n: number;
        newest: Date;
        channel: NotifyChannel;
      }>(
        `WITH am AS (${ACTIVE_MEMBERS}),
         visible AS (
           SELECT p.user_id, p.conversation_id FROM conversation_participants p
           UNION
           SELECT am.user_id, cv.id FROM conversations cv JOIN am ON am.class_id = cv.class_id
         ),
         digests AS (
           SELECT user_id, max(covers_until) AS covered, max(created_at) AS last_at
           FROM notification_deliveries WHERE kind = 'message' GROUP BY user_id
         ),
         waiting AS (
           SELECT v.user_id, count(*)::int AS n, min(m.created_at) AS oldest, max(m.created_at) AS newest
           FROM visible v
           JOIN messages m ON m.conversation_id = v.conversation_id
           LEFT JOIN conversation_reads r ON r.conversation_id = v.conversation_id AND r.user_id = v.user_id
           LEFT JOIN digests d ON d.user_id = v.user_id
           WHERE m.sender_id IS DISTINCT FROM v.user_id
             AND m.created_at > $1
             AND m.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz)
             AND m.created_at > coalesce(d.covered, '-infinity'::timestamptz)
           GROUP BY v.user_id
         )
         SELECT w.user_id, w.n, w.newest, coalesce(p.message_channel, 'app') AS channel
         FROM waiting w
         JOIN users u ON u.id = w.user_id AND u.disabled_at IS NULL
         LEFT JOIN notification_preferences p ON p.user_id = w.user_id
         LEFT JOIN digests d ON d.user_id = w.user_id
         WHERE w.oldest <= $2 AND (d.last_at IS NULL OR d.last_at <= $3)
           -- Hors de l'application, ou dans l'application avec un appareil (push).
           AND (p.message_channel IN ('email', 'sms', 'whatsapp')
             OR (coalesce(p.message_channel, 'app') = 'app'
                 AND EXISTS (SELECT 1 FROM push_tokens t WHERE t.user_id = w.user_id)))
         ORDER BY w.user_id`,
        [
          input.since.toISOString(),
          input.oldestBefore.toISOString(),
          input.lastBefore.toISOString(),
        ],
      );
      return rows.map((r) => ({
        userId: r.user_id,
        count: r.n,
        newest: r.newest,
        channel: r.channel,
      }));
    },

    /** Ajoute une notification au journal ; `null` si elle existe déjà (même relance, même rappel). */
    async enqueue(input: {
      userId: string;
      kind: DeliveryKind;
      channel: NotifyChannel;
      nudgeId?: string;
      sessionId?: string;
      reminder?: "24h" | "1h";
      linkPath?: string;
      messageCount?: number;
      coversUntil?: Date;
      subject: string;
      body: string;
      notBefore: Date;
      /** Notification dans l'application : enregistrée comme déjà remise. */
      delivered: boolean;
      now: Date;
    }): Promise<string | null> {
      const { rows } = await db.query<{ id: string }>(
        `INSERT INTO notification_deliveries
           (id, user_id, kind, channel, status, nudge_id, message_count, covers_until,
            subject, body, provider, not_before, created_at, sent_at,
            session_id, reminder, link_path)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
         ON CONFLICT DO NOTHING RETURNING id`,
        [
          randomUUID(),
          input.userId,
          input.kind,
          input.channel,
          input.delivered ? "sent" : "pending",
          input.nudgeId ?? null,
          input.messageCount ?? null,
          input.coversUntil?.toISOString() ?? null,
          input.subject,
          input.body,
          input.delivered ? "app" : null,
          input.notBefore.toISOString(),
          input.now.toISOString(),
          input.delivered ? input.now.toISOString() : null,
          input.sessionId ?? null,
          input.reminder ?? null,
          input.linkPath ?? null,
        ],
      );
      return rows[0]?.id ?? null;
    },

    /**
     * Réserve les envois dus : chaque ligne est « louée » (repoussée de
     * `leaseMs`) pour qu'un autre serveur ne l'envoie pas en même temps.
     */
    async claimDue(now: Date, leaseMs: number, limit: number) {
      const { rows } = await db.query<DeliveryRow>(
        `UPDATE notification_deliveries SET attempts = attempts + 1, not_before = $2
         WHERE id IN (
           SELECT id FROM notification_deliveries
           WHERE status = 'pending' AND not_before <= $1
           ORDER BY not_before LIMIT $3 FOR UPDATE SKIP LOCKED
         ) RETURNING ${DELIVERY_COLUMNS}`,
        [
          now.toISOString(),
          new Date(now.getTime() + leaseMs).toISOString(),
          limit,
        ],
      );
      return rows.map(toDelivery);
    },

    async markSent(
      id: string,
      sent: { provider: string; ref: string | null },
      now: Date,
    ) {
      await db.query(
        "UPDATE notification_deliveries SET status = 'sent', provider = $2, provider_ref = $3, sent_at = $4, last_error = NULL WHERE id = $1",
        [id, sent.provider, sent.ref, now.toISOString()],
      );
    },

    /** Nouvel essai plus tard (erreur passagère). */
    async retryLater(id: string, error: string, notBefore: Date) {
      await db.query(
        "UPDATE notification_deliveries SET last_error = $2, not_before = $3 WHERE id = $1",
        [id, error, notBefore.toISOString()],
      );
    },

    /** Repoussé (heures calmes) : la tentative ne compte pas. */
    async defer(id: string, notBefore: Date) {
      await db.query(
        "UPDATE notification_deliveries SET attempts = greatest(attempts - 1, 0), not_before = $2 WHERE id = $1",
        [id, notBefore.toISOString()],
      );
    },

    async close(id: string, status: "failed" | "cancelled", error: string) {
      await db.query(
        "UPDATE notification_deliveries SET status = $2, last_error = $3 WHERE id = $1",
        [id, status, error],
      );
    },

    /** État d'une séance au moment d'envoyer son rappel (null : supprimée). */
    async sessionState(
      sessionId: string,
    ): Promise<{ status: string; startsAt: Date } | null> {
      const { rows } = await db.query<{ status: string; starts_at: Date }>(
        "SELECT status, starts_at FROM tutoring_sessions WHERE id = $1",
        [sessionId],
      );
      const r = rows[0];
      return r ? { status: r.status, startsAt: new Date(r.starts_at) } : null;
    },

    /** Dernières notifications de la personne (journal visible dans son compte). */
    async recent(userId: string, limit = 20): Promise<Delivery[]> {
      const { rows } = await db.query<DeliveryRow>(
        `SELECT ${DELIVERY_COLUMNS} FROM notification_deliveries
         WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
        [userId, limit],
      );
      return rows.map(toDelivery);
    },
  };
  return store;
}

export type NotificationStore = ReturnType<typeof createNotificationStore>;
