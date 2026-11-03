import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { asEventId, asLearnerId, asNotionId, asUserId } from "@wema/domain";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createAccountStore,
  createEventStore,
  createPrivacyStore,
  DEFAULT_PRIVACY_SETTINGS,
  exportUserData,
  fromPglite,
  loadPrivacySettings,
  migrate,
  PURGED_DISPLAY_NAME,
  purgeUser,
  runRetention,
  type SqlExecutor,
} from "./index";

let db: SqlExecutor;

beforeEach(async () => {
  db = fromPglite(new PGlite());
  await migrate(db);
});

const now = new Date("2026-11-03T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

async function learnerWithData() {
  const accounts = createAccountStore(db);
  const user = await accounts.createUser({
    displayName: "Élève Test",
    createdBy: null,
  });
  await accounts.addIdentity({
    userId: user.id,
    kind: "username",
    identifier: "eleve-test",
    secretHash: "empreinte",
    verified: false,
  });
  await accounts.createSession({
    tokenHash: `jeton-${randomUUID()}`,
    userId: user.id,
    expiresAt: new Date(now.getTime() + DAY),
  });
  await createEventStore(db).append({
    id: asEventId(randomUUID()),
    learnerId: asLearnerId(user.id),
    occurredAt: now,
    source: "app",
    payload: {
      type: "answer.submitted",
      notionId: asNotionId("maths.pythagore"),
      correct: true,
      hintsUsed: 0,
      misconceptionId: null,
      exerciseRef: null,
      response: "x = 1",
      scaffolded: null,
      misconceptionSource: null,
      misconceptionConfidence: null,
    },
  });
  return user;
}

const countEvents = async () =>
  (
    await db.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM learning_events",
    )
  ).rows[0]?.n;

describe("verrou « ajout seul » et purge réglementaire", () => {
  it("une suppression ordinaire du journal reste refusée", async () => {
    await learnerWithData();
    await expect(db.exec("DELETE FROM learning_events")).rejects.toThrow(
      /ajout seul/,
    );
    expect(await countEvents()).toBe(1);
  });

  it("le réglage de purge ne survit pas à sa transaction", async () => {
    await learnerWithData();
    await db.transaction(async (tx) => {
      await tx.query("SELECT set_config('wema.regulatory_purge', 'on', true)");
    });
    await expect(db.exec("DELETE FROM learning_events")).rejects.toThrow(
      /ajout seul/,
    );
  });

  it("même en purge, UPDATE et TRUNCATE restent interdits, et l'audit n'est jamais effaçable", async () => {
    await learnerWithData();
    await expect(
      db.transaction(async (tx) => {
        await tx.query(
          "SELECT set_config('wema.regulatory_purge', 'on', true)",
        );
        await tx.exec("UPDATE learning_events SET source = 'web'");
      }),
    ).rejects.toThrow(/ajout seul/);
    await expect(
      db.transaction(async (tx) => {
        await tx.query(
          "SELECT set_config('wema.regulatory_purge', 'on', true)",
        );
        await tx.exec("TRUNCATE learning_events");
      }),
    ).rejects.toThrow(/ajout seul/);
    await db.exec(
      `INSERT INTO audit_log (id, action, target_type) VALUES ('${randomUUID()}', 'test', 'test')`,
    );
    await expect(
      db.transaction(async (tx) => {
        await tx.query(
          "SELECT set_config('wema.regulatory_purge', 'on', true)",
        );
        await tx.exec("DELETE FROM audit_log");
      }),
    ).rejects.toThrow(/ajout seul/);
  });

  it("purge un compte : journal effacé, ligne anonyme, trace sans donnée personnelle", async () => {
    const user = await learnerWithData();
    const counts = await purgeUser(db, user.id, now);
    expect(counts.learningEvents).toBe(1);
    expect(counts.identities).toBe(1);
    expect(counts.sessions).toBe(1);
    expect(await countEvents()).toBe(0);
    const stored = await createAccountStore(db).getUser(user.id);
    expect(stored?.displayName).toBe(PURGED_DISPLAY_NAME);
    expect(stored?.disabled).toBe(true);
    expect(await createPrivacyStore(db).isPurged(user.id)).toBe(true);
    const audit = await db.query<{ details: Record<string, unknown> }>(
      "SELECT details FROM audit_log WHERE action = 'account.purge' AND target_id = $1",
      [user.id],
    );
    expect(audit.rows).toHaveLength(1);
    expect(JSON.stringify(audit.rows[0]?.details)).not.toContain("Élève");
    // Après la purge, le verrou est de nouveau en place.
    await learnerWithData();
    await expect(db.exec("DELETE FROM learning_events")).rejects.toThrow(
      /ajout seul/,
    );
  });
});

describe("demandes de suppression et conservation", () => {
  it("une seule demande en cours ; annulable ; purgée à l'échéance", async () => {
    const user = await learnerWithData();
    const privacy = createPrivacyStore(db);
    const first = await privacy.requestDeletion({
      userId: user.id,
      requestedBy: user.id,
      reason: "self",
      scheduledFor: new Date(now.getTime() + 30 * DAY),
    });
    const again = await privacy.requestDeletion({
      userId: user.id,
      requestedBy: user.id,
      reason: "self",
      scheduledFor: new Date(now.getTime() + 60 * DAY),
    });
    expect(again.id).toBe(first.id);

    // Avant l'échéance : rien n'est purgé.
    let result = await runRetention(db, DEFAULT_PRIVACY_SETTINGS, now);
    expect(result.purged).toBe(0);
    expect(await countEvents()).toBe(1);

    expect(await privacy.cancelDeletion(user.id, now)).toBe(true);
    expect(await privacy.pendingDeletion(user.id)).toBeNull();

    await privacy.requestDeletion({
      userId: user.id,
      requestedBy: user.id,
      reason: "self",
      scheduledFor: new Date(now.getTime() + DAY),
    });
    result = await runRetention(
      db,
      DEFAULT_PRIVACY_SETTINGS,
      new Date(now.getTime() + 2 * DAY),
    );
    expect(result.purged).toBe(1);
    expect(await countEvents()).toBe(0);
    expect(await privacy.pendingDeletion(user.id)).toBeNull();
  });

  it("efface sessions expirées, vieux codes et vieux appels d'IA", async () => {
    const user = await learnerWithData();
    await db.query(
      "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ('vieux', $1, $2)",
      [user.id, new Date(now.getTime() - DAY).toISOString()],
    );
    await db.query(
      "INSERT INTO one_time_codes (id, phone, code_hash, expires_at) VALUES ($1, '+10000000000', 'h', $2)",
      [randomUUID(), new Date(now.getTime() - 3 * DAY).toISOString()],
    );
    await db.query(
      `INSERT INTO ai_calls (id, at, task, provider, model, latency_ms, status)
       VALUES ($1, $2, 'tutor', 'openrouter', 'm', 1, 'ok')`,
      [randomUUID(), new Date(now.getTime() - 400 * DAY).toISOString()],
    );
    for (const status of ["sent", "pending"])
      await db.query(
        `INSERT INTO notification_deliveries (id, user_id, kind, channel, status, body, not_before, created_at)
         VALUES ($1, $2, 'message', 'app', $3, 'Nouveau message', $4, $4)`,
        [
          randomUUID(),
          user.id,
          status,
          new Date(now.getTime() - 100 * DAY).toISOString(),
        ],
      );
    const result = await runRetention(db, DEFAULT_PRIVACY_SETTINGS, now);
    expect(result.sessions).toBe(1);
    expect(result.oneTimeCodes).toBe(1);
    expect(result.aiCalls).toBe(1);
    // L'envoi en attente est gardé.
    expect(result.deliveryLogs).toBe(1);
  });

  it("programme la suppression d'un compte inactif, et l'annule s'il revient", async () => {
    const user = await learnerWithData();
    await db.query("UPDATE users SET last_seen_at = $2 WHERE id = $1", [
      user.id,
      new Date(now.getTime() - 800 * DAY).toISOString(),
    ]);
    const result = await runRetention(db, DEFAULT_PRIVACY_SETTINGS, now);
    expect(result.inactiveScheduled).toBe(1);
    const pending = await createPrivacyStore(db).pendingDeletion(user.id);
    expect(pending?.reason).toBe("inactivity");
    expect(pending?.scheduledFor.getTime()).toBe(now.getTime() + 30 * DAY);

    // Il se reconnecte pendant le délai de grâce.
    await db.query("UPDATE users SET last_seen_at = $2 WHERE id = $1", [
      user.id,
      new Date(now.getTime() + DAY).toISOString(),
    ]);
    const later = await runRetention(
      db,
      DEFAULT_PRIVACY_SETTINGS,
      new Date(now.getTime() + 2 * DAY),
    );
    expect(later.inactivityCancelled).toBe(1);
    expect(await createPrivacyStore(db).pendingDeletion(user.id)).toBeNull();
  });

  it("lit les réglages en complétant par les valeurs par défaut", async () => {
    await db.query(
      `INSERT INTO settings (key, value) VALUES ('privacy', '{"deletionGraceDays": 7}'::jsonb)`,
    );
    const settings = await loadPrivacySettings(db);
    expect(settings.deletionGraceDays).toBe(7);
    expect(settings.inactiveAccountDays).toBe(
      DEFAULT_PRIVACY_SETTINGS.inactiveAccountDays,
    );
  });
});

describe("consentement, conditions et export", () => {
  it("enregistre le consentement parental et les conditions acceptées", async () => {
    const accounts = createAccountStore(db);
    const parent = await accounts.createUser({
      displayName: "Parent Test",
      createdBy: null,
    });
    const child = await learnerWithData();
    const privacy = createPrivacyStore(db);
    const consent = {
      learnerId: child.id,
      guardianId: parent.id,
      method: "account" as const,
      termsVersion: "v1",
      privacyVersion: "v1",
    };
    await privacy.recordParentalConsent(consent);
    await privacy.recordParentalConsent(consent);
    const consents = await privacy.consentsFor(child.id);
    expect(consents).toHaveLength(1);
    expect(consents[0]?.guardianName).toBe("Parent Test");

    expect(
      await privacy.hasAccepted({
        userId: parent.id,
        termsVersion: "v1",
        privacyVersion: "v1",
      }),
    ).toBe(false);
    await privacy.acceptTerms({
      userId: parent.id,
      termsVersion: "v1",
      privacyVersion: "v1",
    });
    expect((await privacy.lastAcceptance(parent.id))?.termsVersion).toBe("v1");
  });

  it("exporte les données sans aucun secret", async () => {
    const user = await learnerWithData();
    const data = await exportUserData(db, asUserId(user.id));
    expect(data.account).not.toBeNull();
    expect(data.identities).toHaveLength(1);
    expect(data.learningEvents).toHaveLength(1);
    const text = JSON.stringify(data);
    expect(text).not.toContain("empreinte");
    expect(text).not.toContain("jeton-");
  });
});
