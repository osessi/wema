import type { SqlExecutor } from "@wema/db";
import { asUserId, type Result } from "@wema/domain";
import { createPushTokenStore } from "../push-tokens";
import type { SendError, Senders, SendOk } from "./channels";
import { DEVICE_NOT_REGISTERED, EXPO_RECEIPTS_BATCH } from "./expo";
import { enqueueSessionReminders } from "./reminders";
import {
  type Audience,
  type DeliveryKind,
  isQuiet,
  messageDigestNotification,
  nextAllowedAt,
  nudgeNotification,
  preferenceKind,
  type QuietHours,
  renderEmail,
  renderText,
  unsubscribeToken,
} from "./rules";
import {
  createNotificationStore,
  type Delivery,
  type NotificationPreferences,
} from "./store";

const MINUTE = 60_000;
/** Une relance n'est notifiée que dans les 24 h qui suivent sa préparation. */
export const NUDGE_NOTIFY_WINDOW_MS = 24 * 60 * MINUTE;
/** Messagerie : on attend 10 min (la personne lit peut-être déjà dans l'appli)… */
export const MESSAGE_DEBOUNCE_MS = 10 * MINUTE;
/** … et au plus une notification de messages par heure. */
export const MESSAGE_MIN_INTERVAL_MS = 60 * MINUTE;
/** Seuls les messages des 7 derniers jours comptent. */
export const MESSAGE_LOOKBACK_MS = 7 * 24 * 60 * MINUTE;
export const MAX_ATTEMPTS = 3;
const LEASE_MS = 10 * MINUTE;
const BATCH = 50;

export interface NotifyDeps {
  db: SqlExecutor;
  senders: Senders;
  /** Secret du serveur : signe les liens de désinscription. */
  secret: string;
  /** Origine publique (lien de désinscription, servi par l'API sous /api). */
  publicUrl: string;
  /** Adresse des pages de l'application (origine + /app) : liens dans les messages. */
  appUrl: string;
}

const quietOf = (p: NotificationPreferences): QuietHours => ({
  timeZone: p.timeZone,
  start: p.quietStart,
  end: p.quietEnd,
});

export const unsubscribeUrl = (
  deps: Pick<NotifyDeps, "secret" | "publicUrl">,
  userId: string,
  kind: DeliveryKind,
) =>
  `${deps.publicUrl}/api/notifications/unsubscribe/${unsubscribeToken(deps.secret, userId, preferenceKind(kind))}`;

/** Prépare les notifications des relances récentes (élève et parents). */
export async function enqueueNudgeNotifications(
  deps: Pick<NotifyDeps, "db">,
  now: Date,
): Promise<number> {
  const store = createNotificationStore(deps.db);
  let queued = 0;
  for (const r of await store.nudgeRecipients(
    new Date(now.getTime() - NUDGE_NOTIFY_WINDOW_MS),
  )) {
    const n = nudgeNotification({
      recipient: r.recipient,
      nudgeText: r.nudgeText,
      childName: r.childName,
    });
    const prefs = await store.preferences(r.userId);
    const id = await store.enqueue({
      userId: r.userId,
      kind: "nudge",
      channel: r.channel,
      nudgeId: r.nudgeId,
      subject: n.subject,
      body: n.text,
      notBefore: nextAllowedAt(now, quietOf(prefs)),
      // Même dans l'application, la ligne passe par l'envoi (notification push).
      delivered: false,
      now,
    });
    if (id) queued++;
  }
  return queued;
}

/** Prépare une notification regroupée par personne qui a des messages non lus. */
export async function enqueueMessageDigests(
  deps: Pick<NotifyDeps, "db">,
  now: Date,
): Promise<number> {
  const store = createNotificationStore(deps.db);
  let queued = 0;
  const candidates = await store.messageDigestCandidates({
    since: new Date(now.getTime() - MESSAGE_LOOKBACK_MS),
    oldestBefore: new Date(now.getTime() - MESSAGE_DEBOUNCE_MS),
    lastBefore: new Date(now.getTime() - MESSAGE_MIN_INTERVAL_MS),
  });
  for (const c of candidates) {
    const audience: Audience = (await store.isLearner(c.userId))
      ? "learner"
      : "adult";
    const n = messageDigestNotification(audience, c.count);
    const prefs = await store.preferences(c.userId);
    if (
      await store.enqueue({
        userId: c.userId,
        kind: "message",
        channel: c.channel,
        messageCount: c.count,
        coversUntil: c.newest,
        subject: n.subject,
        body: n.text,
        notBefore: nextAllowedAt(now, quietOf(prefs)),
        delivered: false,
        now,
      })
    )
      queued++;
  }
  return queued;
}

type Outcome = "sent" | "deferred" | "retry" | "failed" | "cancelled";

async function deliver(
  deps: NotifyDeps,
  d: Delivery,
  now: Date,
): Promise<Outcome> {
  const store = createNotificationStore(deps.db);
  // Une ligne qui plante à chaque passage finit par être abandonnée.
  if (d.attempts > MAX_ATTEMPTS + 1) return fail(store, d, "too_many_attempts");
  const prefs = await store.preferences(d.userId);
  const choice =
    preferenceKind(d.kind) === "nudge"
      ? prefs.nudgeChannel
      : prefs.messageChannel;
  // La personne a changé d'avis depuis : on n'envoie pas.
  if (choice !== d.channel) {
    await store.close(d.id, "cancelled", "preference_changed");
    return "cancelled";
  }
  // Rappel de séance : la séance doit toujours avoir lieu, et pas encore commencé.
  if (d.kind === "session_reminder" && d.sessionId) {
    const session = await store.sessionState(d.sessionId);
    if (session?.status !== "confirmed") {
      await store.close(d.id, "cancelled", "session_not_confirmed");
      return "cancelled";
    }
    if (session.startsAt <= now) {
      await store.close(d.id, "cancelled", "session_started");
      return "cancelled";
    }
    // Un rappel 24 h repoussé jusqu'à moins d'une heure : le rappel 1 h suffit.
    if (
      d.reminder === "24h" &&
      session.startsAt.getTime() - now.getTime() <= 60 * MINUTE
    ) {
      await store.close(d.id, "cancelled", "superseded");
      return "cancelled";
    }
  }
  const quiet = quietOf(prefs);
  // Le rappel 1 h avant une séance passe outre les heures calmes.
  const urgent = d.kind === "session_reminder" && d.reminder === "1h";
  if (!urgent && isQuiet(now, quiet)) {
    await store.defer(d.id, nextAllowedAt(now, quiet));
    return "deferred";
  }
  const addresses = await store.addresses(d.userId);
  const audience: Audience = (await store.isLearner(d.userId))
    ? "learner"
    : "adult";
  const notification = { subject: d.subject ?? "Wema", text: d.body };
  const links = {
    appUrl: `${deps.appUrl}${d.linkPath ?? "/"}`,
    unsubscribeUrl: unsubscribeUrl(deps, d.userId, d.kind),
  };

  let result: Result<SendOk, SendError>;
  if (d.channel === "email") {
    if (!addresses.email) return fail(store, d, "no_address");
    if (!deps.senders.email) return fail(store, d, "channel_unavailable");
    const email = renderEmail(notification, audience, links);
    result = await deps.senders.email.send({
      to: addresses.email,
      ...email,
      unsubscribeUrl: links.unsubscribeUrl,
    });
  } else if (d.channel === "sms" || d.channel === "whatsapp") {
    if (!addresses.phone) return fail(store, d, "no_address");
    const sender = deps.senders[d.channel];
    if (!sender) return fail(store, d, "channel_unavailable");
    result = await sender.send({
      channel: d.channel,
      to: addresses.phone,
      body: renderText(notification, links),
      template: { purpose: "notification", variables: [notification.text] },
    });
  } else {
    // « app » : la notification est visible dans l'application ; on envoie
    // aussi un push aux appareils de la personne, s'il y en a.
    const pushed = await sendPush(deps, d, notification, now);
    if (!pushed.ok && pushed.error.retryable && d.attempts < MAX_ATTEMPTS) {
      await store.retryLater(
        d.id,
        pushed.error.reason,
        new Date(now.getTime() + 15 * MINUTE * d.attempts),
      );
      return "retry";
    }
    // Échec définitif du push : la notification reste dans l'application.
    await store.markSent(
      d.id,
      pushed.ok ? pushed.value : { provider: "app", ref: null },
      now,
    );
    return "sent";
  }

  if (result.ok) {
    await store.markSent(d.id, result.value, now);
    return "sent";
  }
  if (result.error.retryable && d.attempts < MAX_ATTEMPTS) {
    await store.retryLater(
      d.id,
      result.error.reason,
      new Date(now.getTime() + 15 * MINUTE * d.attempts),
    );
    return "retry";
  }
  return fail(store, d, result.error.reason);
}

/**
 * Push Expo vers les appareils de la personne. Un ticket « DeviceNotRegistered »
 * retire le jeton tout de suite ; les tickets acceptés attendent leur reçu.
 */
async function sendPush(
  deps: NotifyDeps,
  d: Delivery,
  notification: { subject: string; text: string },
  now: Date,
): Promise<Result<SendOk, SendError>> {
  const none: Result<SendOk, SendError> = {
    ok: true,
    value: { provider: "app", ref: null },
  };
  const push = deps.senders.push;
  if (!push) return none;
  const tokens = createPushTokenStore(deps.db);
  const devices = await tokens.tokensOf(asUserId(d.userId));
  if (devices.length === 0) return none;
  const sent = await push.send(
    devices.map((t) => ({
      to: t.token,
      title: notification.subject,
      body: notification.text,
      data: { path: d.linkPath ?? "/" },
    })),
  );
  if (!sent.ok) return sent;
  const accepted: { id: string; token: string }[] = [];
  for (const t of sent.value) {
    if (t.ok) accepted.push({ id: t.id, token: t.to });
    else if (t.error === DEVICE_NOT_REGISTERED) await tokens.forget(t.to);
  }
  await tokens.saveTickets(accepted, now);
  return {
    ok: true,
    value:
      accepted.length > 0
        ? { provider: push.provider, ref: accepted[0]?.id ?? null }
        : { provider: "app", ref: null },
  };
}

/** Expo prépare ses reçus en quelques minutes et les garde 24 h. */
export const PUSH_RECEIPT_DELAY_MS = 15 * MINUTE;
const PUSH_RECEIPT_MAX_AGE_MS = 24 * 60 * MINUTE;

/** Lit les reçus des push envoyés : un appareil désinscrit perd son jeton. */
export async function checkPushReceipts(
  deps: Pick<NotifyDeps, "db" | "senders">,
  now: Date,
): Promise<{ checked: number; forgotten: number }> {
  const push = deps.senders.push;
  if (!push) return { checked: 0, forgotten: 0 };
  const tokens = createPushTokenStore(deps.db);
  const due = await tokens.ticketsDue(
    new Date(now.getTime() - PUSH_RECEIPT_DELAY_MS),
    EXPO_RECEIPTS_BATCH,
  );
  const oldest = new Date(now.getTime() - PUSH_RECEIPT_MAX_AGE_MS);
  if (due.length === 0) {
    await tokens.dropTickets([], oldest);
    return { checked: 0, forgotten: 0 };
  }
  const receipts = await push.receipts(due.map((t) => t.id));
  // Expo injoignable : on réessaiera au prochain passage.
  if (!receipts.ok) return { checked: 0, forgotten: 0 };
  let forgotten = 0;
  const read: string[] = [];
  for (const t of due) {
    const r = receipts.value.get(t.id);
    if (!r) continue; // pas encore prêt
    read.push(t.id);
    if (!r.ok && r.error === DEVICE_NOT_REGISTERED) {
      await tokens.forget(t.token);
      forgotten++;
    }
  }
  await tokens.dropTickets(read, oldest);
  return { checked: read.length, forgotten };
}

async function fail(
  store: ReturnType<typeof createNotificationStore>,
  d: Delivery,
  reason: string,
): Promise<Outcome> {
  await store.close(d.id, "failed", reason);
  return "failed";
}

/** Envoie ce qui est dû (hors heures calmes), avec nouveaux essais limités. */
export async function sendDueNotifications(
  deps: NotifyDeps,
  now: Date,
): Promise<Record<Outcome, number>> {
  const store = createNotificationStore(deps.db);
  const counts: Record<Outcome, number> = {
    sent: 0,
    deferred: 0,
    retry: 0,
    failed: 0,
    cancelled: 0,
  };
  for (const d of await store.claimDue(now, LEASE_MS, BATCH)) {
    try {
      counts[await deliver(deps, d, now)]++;
    } catch (e) {
      // La ligne reste louée puis sera reprise ; aucune donnée personnelle dans le log.
      counts.retry++;
      console.error(`Envois : ${e instanceof Error ? e.name : "erreur"}`);
    }
  }
  return counts;
}

/**
 * Passage complet (toutes les 5 minutes) : préparer (relances, messages,
 * rappels de séance), envoyer, puis lire les reçus des push.
 */
export async function runNotifications(deps: NotifyDeps, now: Date) {
  const nudges = await enqueueNudgeNotifications(deps, now);
  const messages = await enqueueMessageDigests(deps, now);
  const reminders = await enqueueSessionReminders(deps, now);
  const sent = await sendDueNotifications(deps, now);
  await checkPushReceipts(deps, now);
  return { queued: nudges + messages, reminders: reminders.sent, ...sent };
}
