import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Règles des envois, sans entrée-sortie : heures calmes selon le fuseau de la
 * personne, lien de désinscription signé, textes des notifications.
 */

export type NotifyChannel = "app" | "email" | "sms" | "whatsapp";
export type ChannelChoice = NotifyChannel | "off";
/** Sorte de préférence (et de lien de désinscription). */
export type NotificationKind = "nudge" | "message";
/**
 * Type d'une notification du journal. Les rappels de séance suivent la
 * préférence des messages (`message_channel`) : voir docs/architecture.md.
 */
export type DeliveryKind = NotificationKind | "session_reminder";

/** Préférence qui gouverne un type de notification. */
export const preferenceKind = (kind: DeliveryKind): NotificationKind =>
  kind === "nudge" ? "nudge" : "message";

export const DEFAULT_QUIET = { start: 21, end: 8 } as const;

// ---------------------------------------------------------------- heures calmes

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Heure et minute locales d'un instant dans un fuseau (UTC si absent ou invalide). */
export function localTime(
  at: Date,
  timeZone: string | null,
): { hour: number; minute: number } {
  const tz = timeZone && isValidTimeZone(timeZone) ? timeZone : "UTC";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  return { hour: get("hour") % 24, minute: get("minute") };
}

export interface QuietHours {
  timeZone: string | null;
  /** Début (inclus) et fin (exclue), en heures locales ; égales : jamais calme. */
  start: number;
  end: number;
}

export function isQuiet(at: Date, q: QuietHours): boolean {
  if (q.start === q.end) return false;
  const { hour } = localTime(at, q.timeZone);
  return q.start < q.end
    ? hour >= q.start && hour < q.end
    : hour >= q.start || hour < q.end;
}

/** Premier instant, à partir de `at`, hors des heures calmes. */
export function nextAllowedAt(at: Date, q: QuietHours): Date {
  if (!isQuiet(at, q)) return at;
  const { hour, minute } = localTime(at, q.timeZone);
  const minutesToEnd =
    (((q.end * 60 - (hour * 60 + minute)) % 1440) + 1440) % 1440;
  let candidate = new Date(at.getTime() + minutesToEnd * 60_000);
  candidate.setUTCSeconds(0, 0);
  // Un changement d'heure peut décaler d'une heure : on avance jusqu'à sortir.
  for (let i = 0; i < 4 && isQuiet(candidate, q); i++)
    candidate = new Date(candidate.getTime() + 60 * 60_000);
  // … ou nous faire sortir une heure trop tard : on recule tant que c'est permis.
  for (let i = 0; i < 2; i++) {
    const earlier = new Date(candidate.getTime() - 60 * 60_000);
    if (earlier <= at || isQuiet(earlier, q)) break;
    candidate = earlier;
  }
  return candidate;
}

// ------------------------------------------------------------ désinscription

const KIND_BYTE: Record<NotificationKind, number> = { nudge: 0, message: 1 };
const SIG_BYTES = 12;

const unsubscribeKey = (secret: string) =>
  createHmac("sha256", secret).update("wema-desinscription").digest();

const sign = (secret: string, payload: Buffer) =>
  createHmac("sha256", unsubscribeKey(secret))
    .update(payload)
    .digest()
    .subarray(0, SIG_BYTES);

/** Jeton court (≈ 40 caractères) : utilisateur, sorte de notification, signature. */
export function unsubscribeToken(
  secret: string,
  userId: string,
  kind: NotificationKind,
): string {
  const payload = Buffer.concat([
    Buffer.from(userId.replace(/-/g, ""), "hex"),
    Buffer.from([KIND_BYTE[kind]]),
  ]);
  return Buffer.concat([payload, sign(secret, payload)]).toString("base64url");
}

export function verifyUnsubscribeToken(
  secret: string,
  token: string,
): { userId: string; kind: NotificationKind } | null {
  if (!/^[A-Za-z0-9_-]{30,60}$/.test(token)) return null;
  const raw = Buffer.from(token, "base64url");
  if (raw.length !== 17 + SIG_BYTES) return null;
  const payload = raw.subarray(0, 17);
  const expected = sign(secret, payload);
  if (!timingSafeEqual(expected, raw.subarray(17))) return null;
  const kind =
    payload[16] === 0 ? "nudge" : payload[16] === 1 ? "message" : null;
  if (!kind) return null;
  const hex = payload.subarray(0, 16).toString("hex");
  const userId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  return { userId, kind };
}

// -------------------------------------------------------------------- textes

/** Élève : tutoiement, jamais de contenu commercial. Adulte : vouvoiement. */
export type Audience = "learner" | "adult";

export interface Notification {
  subject: string;
  /** Texte court, sans lien (les liens sont ajoutés à l'envoi). */
  text: string;
}

/** Vocabulaire commercial : interdit dans tout envoi à un élève (mineur). */
const COMMERCIAL =
  /promo|offre|r[ée]duction|remise|abonn|gratuit|\bprix\b|tarif|€|\$|fcfa|acheter|achat|payer|paiement|parrain|essai premium|premium/i;

export function looksCommercial(text: string): boolean {
  return COMMERCIAL.test(text);
}

const LEARNER_FALLBACK = "Ton prof IA t'attend sur Wema. On reprend ensemble ?";

/** Relance : à l'élève (son texte de relance) ou à son parent (texte fixe, bienveillant). */
export function nudgeNotification(input: {
  recipient: "learner" | "guardian";
  nudgeText: string;
  childName: string;
}): Notification {
  if (input.recipient === "learner") {
    const text = input.nudgeText.trim();
    return {
      subject: "Un petit mot de Wema",
      text: text.length > 0 && !looksCommercial(text) ? text : LEARNER_FALLBACK,
    };
  }
  return {
    subject: `Des nouvelles de ${input.childName} sur Wema`,
    text: `Bonjour, ${input.childName} a une activité qui l'attend sur Wema. Un mot d'encouragement de votre part peut l'aider à s'y remettre.`,
  };
}

/** Nouveaux messages, regroupés : le nombre seulement (ni auteur, ni contenu). */
export function messageDigestNotification(
  audience: Audience,
  count: number,
): Notification {
  const n = Math.max(1, count);
  const what = n === 1 ? "un nouveau message" : `${n} nouveaux messages`;
  return {
    subject: "Nouveaux messages sur Wema",
    text:
      audience === "learner"
        ? `Tu as ${what} sur Wema.`
        : `Vous avez ${what} sur Wema.`,
  };
}

/** Destinataire d'un rappel de séance, selon son rôle dans la séance. */
export type ReminderRole = "teacher" | "learner" | "guardian";

/** Date et heure locales, en français (« mercredi 4 novembre à 15:00 »). */
export function formatLocalDateTime(at: Date, timeZone: string | null): string {
  const tz = timeZone && isValidTimeZone(timeZone) ? timeZone : "UTC";
  const date = new Intl.DateTimeFormat("fr-FR", {
    timeZone: tz,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(at);
  const time = new Intl.DateTimeFormat("fr-FR", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(at);
  return `${date} à ${time}${tz === "UTC" ? " (UTC)" : ""}`;
}

/**
 * Rappel 24 h ou 1 h avant une séance. Pas de nom d'élève ; pour un élève,
 * le titre n'est repris que s'il n'a rien de commercial.
 */
export function sessionReminderNotification(input: {
  role: ReminderRole;
  reminder: "24h" | "1h";
  startsAt: Date;
  timeZone: string | null;
  teacherName: string;
  title: string | null;
  groupName: string | null;
}): Notification {
  const when =
    input.reminder === "1h"
      ? `dans moins d'une heure (${formatLocalDateTime(input.startsAt, input.timeZone)})`
      : `le ${formatLocalDateTime(input.startsAt, input.timeZone)}`;
  const title =
    input.title && !(input.role === "learner" && looksCommercial(input.title))
      ? ` « ${input.title} »`
      : "";
  const group = input.groupName ? ` (groupe ${input.groupName})` : "";
  const subject =
    input.reminder === "1h"
      ? "Votre séance commence bientôt"
      : "Rappel de séance";
  if (input.role === "learner")
    return {
      subject:
        input.reminder === "1h"
          ? "Ta séance commence bientôt"
          : "Rappel de séance",
      text: `Rappel : ta séance${title} avec ${input.teacherName}${group} commence ${when}.`,
    };
  if (input.role === "guardian")
    return {
      subject,
      text: `Rappel : la séance${title} de votre enfant avec ${input.teacherName} commence ${when}.`,
    };
  return {
    subject,
    text: `Rappel : votre séance${title}${group} commence ${when}.`,
  };
}

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Texte final d'un SMS ou d'un message WhatsApp : le texte, le lien, la désinscription. */
export function renderText(
  n: Notification,
  links: { appUrl: string; unsubscribeUrl: string },
): string {
  return `${n.text}\n${links.appUrl}\nNe plus recevoir : ${links.unsubscribeUrl}`;
}

export function renderEmail(
  n: Notification,
  audience: Audience,
  links: { appUrl: string; unsubscribeUrl: string },
): { subject: string; text: string; html: string } {
  const open = "Ouvrir Wema";
  const stop =
    audience === "learner"
      ? "Tu ne veux plus recevoir ces e-mails ?"
      : "Vous ne souhaitez plus recevoir ces e-mails ?";
  return {
    subject: n.subject,
    text: `${n.text}\n\n${open} : ${links.appUrl}\n\n${stop} ${links.unsubscribeUrl}`,
    html: `<!doctype html><html lang="fr"><body style="font-family:sans-serif;line-height:1.5">
<p>${escapeHtml(n.text)}</p>
<p><a href="${escapeHtml(links.appUrl)}">${open}</a></p>
<p style="font-size:12px;color:#666">${stop} <a href="${escapeHtml(links.unsubscribeUrl)}">Se désinscrire</a></p>
</body></html>`,
  };
}
