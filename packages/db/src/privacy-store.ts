import { randomUUID } from "node:crypto";
import type { OrganizationId, UserId } from "@wema/domain";
import { asUserId } from "@wema/domain";
import { createAuditLog } from "./audit";
import type { SqlExecutor } from "./executor";
import type { PrivacySettings } from "./privacy-settings";

// RGPD (fiche de décision 0008) : consentement parental, conditions acceptées,
// demandes de suppression, purge réglementaire, durées de conservation et
// export des données d'une personne.

export type DeletionReason = "self" | "guardian" | "inactivity";

export interface PendingDeletion {
  id: string;
  userId: UserId;
  requestedBy: UserId | null;
  reason: DeletionReason;
  requestedAt: Date;
  scheduledFor: Date;
}

export interface ParentalConsent {
  id: string;
  learnerId: UserId;
  guardianId: UserId;
  guardianName: string;
  method: "guardian_link" | "account";
  termsVersion: string;
  privacyVersion: string;
  givenAt: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const daysBefore = (now: Date, days: number) =>
  new Date(now.getTime() - days * DAY_MS).toISOString();

/** Nom laissé sur la ligne d'un compte purgé (plus aucune donnée personnelle). */
export const PURGED_DISPLAY_NAME = "Compte supprimé";

/**
 * Lève le verrou « ajout seul » des journaux pour la transaction en cours,
 * pour une SUPPRESSION seulement (migration 0018). À n'appeler que depuis
 * la purge réglementaire, dans une transaction.
 */
async function enterRegulatoryPurge(tx: SqlExecutor): Promise<void> {
  await tx.query("SELECT set_config('wema.regulatory_purge', 'on', true)");
}

interface DeletionRow {
  id: string;
  user_id: string;
  requested_by: string | null;
  reason: DeletionReason;
  requested_at: Date;
  scheduled_for: Date;
}

const toDeletion = (r: DeletionRow): PendingDeletion => ({
  id: r.id,
  userId: asUserId(r.user_id),
  requestedBy: r.requested_by === null ? null : asUserId(r.requested_by),
  reason: r.reason,
  requestedAt: r.requested_at,
  scheduledFor: r.scheduled_for,
});

const PENDING = "cancelled_at IS NULL AND completed_at IS NULL";

export function createPrivacyStore(db: SqlExecutor) {
  return {
    // Conditions -------------------------------------------------------------

    async acceptTerms(input: {
      userId: UserId;
      termsVersion: string;
      privacyVersion: string;
    }): Promise<void> {
      await db.query(
        `INSERT INTO terms_acceptances (user_id, terms_version, privacy_version) VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [input.userId, input.termsVersion, input.privacyVersion],
      );
    },

    async hasAccepted(input: {
      userId: UserId;
      termsVersion: string;
      privacyVersion: string;
    }): Promise<boolean> {
      const { rows } = await db.query(
        `SELECT 1 FROM terms_acceptances WHERE user_id = $1 AND terms_version = $2 AND privacy_version = $3`,
        [input.userId, input.termsVersion, input.privacyVersion],
      );
      return rows.length > 0;
    },

    async lastAcceptance(userId: UserId): Promise<{
      termsVersion: string;
      privacyVersion: string;
      acceptedAt: Date;
    } | null> {
      const { rows } = await db.query<{
        terms_version: string;
        privacy_version: string;
        accepted_at: Date;
      }>(
        `SELECT terms_version, privacy_version, accepted_at FROM terms_acceptances
         WHERE user_id = $1 ORDER BY accepted_at DESC LIMIT 1`,
        [userId],
      );
      const r = rows[0];
      return r
        ? {
            termsVersion: r.terms_version,
            privacyVersion: r.privacy_version,
            acceptedAt: r.accepted_at,
          }
        : null;
    },

    // Consentement parental --------------------------------------------------

    /** Enregistre le consentement d'un parent (sans doublon pour les mêmes versions). */
    async recordParentalConsent(input: {
      learnerId: UserId;
      guardianId: UserId;
      method: "guardian_link" | "account";
      termsVersion: string;
      privacyVersion: string;
    }): Promise<void> {
      const { rows } = await db.query(
        `SELECT 1 FROM parental_consents WHERE learner_id = $1 AND guardian_id = $2
           AND terms_version = $3 AND privacy_version = $4 AND withdrawn_at IS NULL`,
        [
          input.learnerId,
          input.guardianId,
          input.termsVersion,
          input.privacyVersion,
        ],
      );
      if (rows.length > 0) return;
      await db.query(
        `INSERT INTO parental_consents (id, learner_id, guardian_id, method, terms_version, privacy_version)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          randomUUID(),
          input.learnerId,
          input.guardianId,
          input.method,
          input.termsVersion,
          input.privacyVersion,
        ],
      );
    },

    /** Consentements en vigueur pour un élève, du plus récent au plus ancien. */
    async consentsFor(learnerId: UserId): Promise<ParentalConsent[]> {
      const { rows } = await db.query<{
        id: string;
        learner_id: string;
        guardian_id: string;
        display_name: string;
        method: "guardian_link" | "account";
        terms_version: string;
        privacy_version: string;
        given_at: Date;
      }>(
        `SELECT p.id, p.learner_id, p.guardian_id, u.display_name, p.method, p.terms_version,
           p.privacy_version, p.given_at
         FROM parental_consents p JOIN users u ON u.id = p.guardian_id
         WHERE p.learner_id = $1 AND p.withdrawn_at IS NULL
         ORDER BY p.given_at DESC`,
        [learnerId],
      );
      return rows.map((r) => ({
        id: r.id,
        learnerId: asUserId(r.learner_id),
        guardianId: asUserId(r.guardian_id),
        guardianName: r.display_name,
        method: r.method,
        termsVersion: r.terms_version,
        privacyVersion: r.privacy_version,
        givenAt: r.given_at,
      }));
    },

    /**
     * Comptes élèves créés par l'organisation (identifiant élève, ou élève
     * d'une de ses classes) sans aucun consentement parental enregistré.
     */
    async learnersWithoutConsent(
      organizationId: OrganizationId,
    ): Promise<{ userId: UserId; displayName: string }[]> {
      const { rows } = await db.query<{ id: string; display_name: string }>(
        `SELECT u.id, u.display_name FROM users u
         WHERE u.owner_organization_id = $1 AND u.created_by IS NOT NULL AND u.purged_at IS NULL
           AND EXISTS (SELECT 1 FROM memberships m WHERE m.user_id = u.id AND m.organization_id = $1)
           AND (
             EXISTS (SELECT 1 FROM identities i WHERE i.user_id = u.id AND i.kind = 'username')
             OR EXISTS (SELECT 1 FROM class_members cm JOIN classes k ON k.id = cm.class_id
                        WHERE cm.user_id = u.id AND cm.role = 'learner' AND k.organization_id = $1)
           )
           AND NOT EXISTS (SELECT 1 FROM parental_consents p WHERE p.learner_id = u.id AND p.withdrawn_at IS NULL)
         ORDER BY u.display_name`,
        [organizationId],
      );
      return rows.map((r) => ({
        userId: asUserId(r.id),
        displayName: r.display_name,
      }));
    },

    // Suppression de compte --------------------------------------------------

    /** Programme la suppression ; renvoie la demande en cours si elle existe déjà. */
    async requestDeletion(input: {
      userId: UserId;
      requestedBy: UserId | null;
      reason: DeletionReason;
      scheduledFor: Date;
    }): Promise<PendingDeletion> {
      await db.query(
        `INSERT INTO account_deletions (id, user_id, requested_by, reason, scheduled_for)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id) WHERE ${PENDING} DO NOTHING`,
        [
          randomUUID(),
          input.userId,
          input.requestedBy,
          input.reason,
          input.scheduledFor.toISOString(),
        ],
      );
      const pending = await this.pendingDeletion(input.userId);
      if (!pending) throw new Error("demande de suppression introuvable");
      return pending;
    },

    async pendingDeletion(userId: UserId): Promise<PendingDeletion | null> {
      const { rows } = await db.query<DeletionRow>(
        `SELECT id, user_id, requested_by, reason, requested_at, scheduled_for
         FROM account_deletions WHERE user_id = $1 AND ${PENDING}`,
        [userId],
      );
      return rows[0] ? toDeletion(rows[0]) : null;
    },

    async cancelDeletion(userId: UserId, now: Date): Promise<boolean> {
      const { rows } = await db.query(
        `UPDATE account_deletions SET cancelled_at = $2 WHERE user_id = $1 AND ${PENDING} RETURNING id`,
        [userId, now.toISOString()],
      );
      return rows.length > 0;
    },

    async isPurged(userId: UserId): Promise<boolean> {
      const { rows } = await db.query<{ purged_at: Date | null }>(
        "SELECT purged_at FROM users WHERE id = $1",
        [userId],
      );
      return rows[0]?.purged_at != null;
    },
  };
}

export type PrivacyStore = ReturnType<typeof createPrivacyStore>;

/** Ce que la purge a effacé (des nombres seulement : rien de personnel). */
export type PurgeCounts = Record<string, number>;

async function tableExists(db: SqlExecutor, table: string): Promise<boolean> {
  const { rows } = await db.query<{ present: boolean }>(
    "SELECT to_regclass($1) IS NOT NULL AS present",
    [table],
  );
  return rows[0]?.present === true;
}

/** Données personnelles rangées dans des tables facultatives (autres chantiers). */
const OPTIONAL_PURGE_STEPS: readonly {
  name: string;
  table: string;
  sql: string;
}[] = [
  {
    name: "notificationDeliveries",
    table: "notification_deliveries",
    sql: "DELETE FROM notification_deliveries WHERE user_id = $1",
  },
  {
    name: "notificationPreferences",
    table: "notification_preferences",
    sql: "DELETE FROM notification_preferences WHERE user_id = $1",
  },
  {
    name: "pushTokens",
    table: "push_tokens",
    sql: "DELETE FROM push_tokens WHERE user_id = $1",
  },
  {
    name: "tutoringSessions",
    table: "tutoring_sessions",
    sql: "DELETE FROM tutoring_sessions WHERE learner_id = $1 OR teacher_id = $1",
  },
  {
    name: "studyGroupMembers",
    table: "study_group_members",
    sql: "DELETE FROM study_group_members WHERE learner_id = $1",
  },
  {
    name: "studyGroups",
    table: "study_groups",
    sql: "DELETE FROM study_groups WHERE teacher_id = $1",
  },
  {
    name: "availabilityRules",
    table: "availability_rules",
    sql: "DELETE FROM availability_rules WHERE teacher_id = $1",
  },
];

/**
 * Purge réglementaire d'un compte (droit à l'effacement). Efface ses données
 * (journal d'apprentissage compris, AGENTS.md règle 3), ses moyens de
 * connexion et ses liens ; la ligne `users` reste, anonyme, pour que les
 * références (audit, exercices écrits par un prof, coûts d'IA) restent valides.
 * Tracée dans l'audit par l'identifiant seul.
 */
export async function purgeUser(
  db: SqlExecutor,
  userId: UserId,
  now: Date,
): Promise<PurgeCounts> {
  return db.transaction(async (tx) => {
    await enterRegulatoryPurge(tx);
    const counts: PurgeCounts = {};
    const run = async (name: string, sql: string) => {
      const { rows } = await tx.query(`${sql} RETURNING 1`, [userId]);
      counts[name] = (counts[name] ?? 0) + rows.length;
    };
    // Apprentissage (élève).
    await run(
      "tutorMessages",
      "DELETE FROM tutor_messages WHERE session_id IN (SELECT id FROM tutor_sessions WHERE learner_id = $1)",
    );
    await run(
      "tutorSessions",
      "DELETE FROM tutor_sessions WHERE learner_id = $1",
    );
    await run(
      "exerciseAttempts",
      "DELETE FROM exercise_attempts WHERE learner_id = $1",
    );
    await run(
      "exerciseVariants",
      "DELETE FROM exercise_variants WHERE learner_id = $1",
    );
    await run(
      "learningEvents",
      "DELETE FROM learning_events WHERE learner_id = $1",
    );
    await run("nudges", "DELETE FROM nudges WHERE learner_id = $1");
    // Données de santé (fiche 0006) : effacées, et le nom de qui les a déclarées oublié.
    await run(
      "healthDeclarations",
      "DELETE FROM health_declarations WHERE learner_id = $1",
    );
    await run(
      "healthShares",
      "DELETE FROM health_shares WHERE learner_id = $1",
    );
    await tx.query(
      "UPDATE health_declarations SET declared_by = NULL WHERE declared_by = $1",
      [userId],
    );
    await tx.query(
      "UPDATE health_declarations SET consent_by = NULL WHERE consent_by = $1",
      [userId],
    );
    await tx.query(
      "UPDATE health_shares SET granted_by = NULL WHERE granted_by = $1",
      [userId],
    );
    // Liens.
    await run(
      "guardianships",
      "DELETE FROM guardianships WHERE guardian_id = $1 OR learner_id = $1",
    );
    await run("classMembers", "DELETE FROM class_members WHERE user_id = $1");
    await run(
      "parentalConsents",
      "DELETE FROM parental_consents WHERE learner_id = $1",
    );
    await run(
      "termsAcceptances",
      "DELETE FROM terms_acceptances WHERE user_id = $1",
    );
    // Messagerie : ses fils directs disparaissent, ses annonces aussi.
    await run(
      "conversations",
      `DELETE FROM conversations WHERE kind = 'direct'
         AND id IN (SELECT conversation_id FROM conversation_participants WHERE user_id = $1)`,
    );
    await run("messages", "DELETE FROM messages WHERE sender_id = $1");
    await run(
      "conversationReads",
      "DELETE FROM conversation_reads WHERE user_id = $1",
    );
    // Tables des autres chantiers (notifications, appli mobile, agenda) :
    // effacées si elles existent. Les paiements restent (obligation comptable),
    // rattachés à la ligne anonyme.
    for (const step of OPTIONAL_PURGE_STEPS) {
      if (!(await tableExists(tx, step.table))) continue;
      await run(step.name, step.sql);
    }
    if (await tableExists(tx, "tutoring_sessions"))
      await tx.query(
        "UPDATE tutoring_sessions SET requested_by = NULL WHERE requested_by = $1",
        [userId],
      );
    // Compte.
    await run("sessions", "DELETE FROM sessions WHERE user_id = $1");
    await run("identities", "DELETE FROM identities WHERE user_id = $1");
    await run("memberships", "DELETE FROM memberships WHERE user_id = $1");
    await tx.query(
      `UPDATE users SET display_name = $2, disabled_at = coalesce(disabled_at, $3), purged_at = $3,
         last_seen_at = NULL WHERE id = $1`,
      [userId, PURGED_DISPLAY_NAME, now.toISOString()],
    );
    await tx.query(
      `UPDATE account_deletions SET completed_at = $2 WHERE user_id = $1 AND ${PENDING}`,
      [userId, now.toISOString()],
    );
    await createAuditLog(tx).append({
      actorId: null,
      organizationId: null,
      action: "account.purge",
      targetType: "account",
      targetId: userId,
      details: { ...counts },
    });
    return counts;
  });
}

export interface RetentionResult {
  sessions: number;
  oneTimeCodes: number;
  aiCalls: number;
  tutorMessages: number;
  deliveryLogs: number;
  inactiveScheduled: number;
  inactivityCancelled: number;
  purged: number;
  purgeFailed: number;
}

/**
 * Journaux d'envoi (notifications, e-mails, SMS) soumis à la durée
 * `deliveryLogDays` : table, colonne de date, lignes terminées. Une table
 * absente est ignorée.
 */
export const DELIVERY_LOG_TABLES: readonly {
  table: string;
  at: string;
  /** Lignes terminées : un envoi en attente n'est jamais effacé. */
  done: string;
}[] = [
  {
    table: "notification_deliveries",
    at: "created_at",
    done: "status <> 'pending'",
  },
];

/**
 * Passage périodique de conservation : efface ce qui a dépassé sa durée,
 * programme la suppression des comptes inactifs (avec le délai de grâce) et
 * purge les comptes dont la suppression est arrivée à échéance.
 */
export async function runRetention(
  db: SqlExecutor,
  settings: PrivacySettings,
  now: Date,
): Promise<RetentionResult> {
  const count = async (sql: string, params: readonly unknown[]) =>
    (await db.query(`${sql} RETURNING 1`, params)).rows.length;
  const nowIso = now.toISOString();

  const sessions = await count("DELETE FROM sessions WHERE expires_at < $1", [
    nowIso,
  ]);
  const oneTimeCodes = await count(
    "DELETE FROM one_time_codes WHERE expires_at < $1",
    [daysBefore(now, settings.oneTimeCodeDays)],
  );

  // Journaux en ajout seul : suppression dans le cadre de la purge réglementaire.
  const { aiCalls, tutorMessages } = await db.transaction(async (tx) => {
    await enterRegulatoryPurge(tx);
    const ai = await tx.query(
      "DELETE FROM ai_calls WHERE at < $1 RETURNING 1",
      [daysBefore(now, settings.aiCallDays)],
    );
    const tutor =
      settings.tutorConversationDays === null
        ? { rows: [] }
        : await tx.query(
            "DELETE FROM tutor_messages WHERE created_at < $1 RETURNING 1",
            [daysBefore(now, settings.tutorConversationDays)],
          );
    return { aiCalls: ai.rows.length, tutorMessages: tutor.rows.length };
  });

  let deliveryLogs = 0;
  for (const log of DELIVERY_LOG_TABLES) {
    if (!(await tableExists(db, log.table))) continue;
    deliveryLogs += await count(
      `DELETE FROM ${log.table} WHERE ${log.at} < $1 AND ${log.done}`,
      [daysBefore(now, settings.deliveryLogDays)],
    );
  }

  // Comptes revenus pendant le délai de grâce d'une suppression pour inactivité.
  const inactivityCancelled = await count(
    `UPDATE account_deletions d SET cancelled_at = $1 FROM users u
     WHERE u.id = d.user_id AND d.reason = 'inactivity'
       AND d.cancelled_at IS NULL AND d.completed_at IS NULL
       AND u.last_seen_at > d.requested_at`,
    [nowIso],
  );

  // Comptes inactifs (hors équipe Wema) : suppression programmée, pas immédiate.
  const inactiveScheduled = await count(
    `INSERT INTO account_deletions (id, user_id, requested_by, reason, scheduled_for)
     SELECT gen_random_uuid(), u.id, NULL, 'inactivity', $2 FROM users u
     WHERE u.purged_at IS NULL AND coalesce(u.last_seen_at, u.created_at) < $1
       AND NOT EXISTS (SELECT 1 FROM memberships m JOIN organizations o ON o.id = m.organization_id
                       WHERE m.user_id = u.id AND o.kind = 'platform')
       AND NOT EXISTS (SELECT 1 FROM account_deletions d WHERE d.user_id = u.id
                       AND d.cancelled_at IS NULL AND d.completed_at IS NULL)
     ON CONFLICT DO NOTHING`,
    [
      daysBefore(now, settings.inactiveAccountDays),
      new Date(
        now.getTime() + settings.deletionGraceDays * DAY_MS,
      ).toISOString(),
    ],
  );

  const { rows: due } = await db.query<{ user_id: string }>(
    `SELECT user_id FROM account_deletions WHERE ${PENDING} AND scheduled_for <= $1 ORDER BY scheduled_for`,
    [nowIso],
  );
  let purged = 0;
  let purgeFailed = 0;
  for (const row of due) {
    try {
      await purgeUser(db, asUserId(row.user_id), now);
      purged += 1;
    } catch {
      purgeFailed += 1;
    }
  }

  return {
    sessions,
    oneTimeCodes,
    aiCalls,
    tutorMessages,
    deliveryLogs,
    inactiveScheduled,
    inactivityCancelled,
    purged,
    purgeFailed,
  };
}

/**
 * Tout ce que Wema garde sur une personne (droit d'accès et portabilité),
 * sans aucun secret (empreintes de mot de passe, jetons). Les données de santé
 * (chiffrées) et le profil calculé sont ajoutés par l'API.
 */
export async function exportUserData(db: SqlExecutor, userId: UserId) {
  const q = async (sql: string) => (await db.query(sql, [userId])).rows;
  const [user] = await q(
    `SELECT id, display_name AS "displayName", created_at AS "createdAt", last_seen_at AS "lastSeenAt",
       disabled_at AS "disabledAt", (created_by IS NOT NULL) AS "createdByAnAdult"
     FROM users WHERE id = $1`,
  );
  return {
    account: user ?? null,
    identities: await q(
      `SELECT kind, identifier, verified_at AS "verifiedAt", created_at AS "createdAt"
       FROM identities WHERE user_id = $1 ORDER BY created_at`,
    ),
    sessions: await q(
      `SELECT created_at AS "createdAt", last_seen_at AS "lastSeenAt", expires_at AS "expiresAt"
       FROM sessions WHERE user_id = $1 ORDER BY created_at`,
    ),
    memberships: await q(
      `SELECT o.name AS organization, o.kind AS "organizationKind", r.name AS role, m.created_at AS "since"
       FROM memberships m JOIN organizations o ON o.id = m.organization_id JOIN roles r ON r.id = m.role_id
       WHERE m.user_id = $1 ORDER BY m.created_at`,
    ),
    classes: await q(
      `SELECT k.name AS class, cm.role, cm.added_at AS "since"
       FROM class_members cm JOIN classes k ON k.id = cm.class_id WHERE cm.user_id = $1`,
    ),
    guardianships: await q(
      `SELECT g.guardian_id = $1 AS "isGuardian", gu.display_name AS guardian, lu.display_name AS learner,
         g.created_at AS "since"
       FROM guardianships g JOIN users gu ON gu.id = g.guardian_id JOIN users lu ON lu.id = g.learner_id
       WHERE g.guardian_id = $1 OR g.learner_id = $1`,
    ),
    parentalConsents: await q(
      `SELECT p.learner_id = $1 AS "aboutMe", lu.display_name AS learner, gu.display_name AS guardian,
         p.method, p.terms_version AS "termsVersion", p.privacy_version AS "privacyVersion",
         p.given_at AS "givenAt", p.withdrawn_at AS "withdrawnAt"
       FROM parental_consents p JOIN users lu ON lu.id = p.learner_id JOIN users gu ON gu.id = p.guardian_id
       WHERE p.learner_id = $1 OR p.guardian_id = $1`,
    ),
    termsAcceptances: await q(
      `SELECT terms_version AS "termsVersion", privacy_version AS "privacyVersion", accepted_at AS "acceptedAt"
       FROM terms_acceptances WHERE user_id = $1 ORDER BY accepted_at`,
    ),
    deletionRequests: await q(
      `SELECT reason, requested_at AS "requestedAt", scheduled_for AS "scheduledFor",
         cancelled_at AS "cancelledAt", completed_at AS "completedAt"
       FROM account_deletions WHERE user_id = $1 ORDER BY requested_at`,
    ),
    learningEvents: await q(
      `SELECT id, occurred_at AS "occurredAt", recorded_at AS "recordedAt", source, type, payload
       FROM learning_events WHERE learner_id = $1 ORDER BY occurred_at, id`,
    ),
    exerciseVariants: await q(
      `SELECT id, statement, level, scaffolded, created_at AS "createdAt"
       FROM exercise_variants WHERE learner_id = $1 ORDER BY created_at`,
    ),
    exerciseAttempts: await q(
      `SELECT variant_id AS "variantId", correct, at FROM exercise_attempts WHERE learner_id = $1 ORDER BY at`,
    ),
    tutorSessions: await q(
      `SELECT s.id, s.mode, s.status, s.created_at AS "createdAt", s.finished_at AS "finishedAt",
         coalesce((SELECT json_agg(json_build_object('role', m.role, 'content', m.content, 'at', m.created_at)
                   ORDER BY m.seq) FROM tutor_messages m WHERE m.session_id = s.id), '[]'::json) AS messages
       FROM tutor_sessions s WHERE s.learner_id = $1 ORDER BY s.created_at`,
    ),
    nudges: await q(
      `SELECT day, reason, content, status, created_at AS "createdAt", read_at AS "readAt"
       FROM nudges WHERE learner_id = $1 ORDER BY created_at`,
    ),
    messages: await q(
      `SELECT m.conversation_id AS "conversationId", c.kind, (m.sender_id = $1) AS "sentByMe",
         su.display_name AS sender, m.body, m.created_at AS "at"
       FROM messages m JOIN conversations c ON c.id = m.conversation_id
       LEFT JOIN users su ON su.id = m.sender_id
       WHERE m.sender_id = $1
          OR c.id IN (SELECT conversation_id FROM conversation_participants WHERE user_id = $1)
       ORDER BY m.created_at`,
    ),
    exercisesWritten: await q(
      `SELECT id, objective, status, created_at AS "createdAt" FROM exercise_intents
       WHERE created_by = $1 ORDER BY created_at`,
    ),
    actions: await q(
      `SELECT at, action, target_type AS "targetType" FROM audit_log WHERE actor_id = $1 ORDER BY at`,
    ),
  };
}
