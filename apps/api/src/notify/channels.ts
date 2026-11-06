import type { Result } from "@wema/domain";
import type { PushSender } from "./expo";

/**
 * Interfaces d'envoi vers l'extérieur (SMS, WhatsApp, e-mail). Chaque
 * prestataire est un adaptateur HTTP (fetch, sans SDK) ; en développement,
 * sans clé, un adaptateur « console » affiche le message.
 */

export type TextChannel = "sms" | "whatsapp";

/** Modèle WhatsApp approuvé (obligatoire hors fenêtre de 24 h de conversation). */
export interface WhatsAppTemplate {
  /** Usage : code de connexion ou notification. Le prestataire choisit son modèle. */
  purpose: "code" | "notification";
  /** Valeurs des variables du modèle, dans l'ordre ({{1}}, {{2}}…). */
  variables: string[];
}

export interface TextMessage {
  channel: TextChannel;
  /** Numéro E.164. */
  to: string;
  body: string;
  /** Pour WhatsApp : modèle à utiliser s'il est configuré, sinon le texte libre. */
  template?: WhatsAppTemplate;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Lien de désinscription en un clic (en-têtes List-Unsubscribe, RFC 8058). */
  unsubscribeUrl?: string;
}

export type SendError = {
  kind: "send_failed";
  /** Code court, sans donnée personnelle ni message brut du prestataire. */
  reason: string;
  /** Vrai si un nouvel essai plus tard a des chances de réussir (réseau, 429, 5xx). */
  retryable: boolean;
};

export type SendOk = { provider: string; ref: string | null };

export interface TextSender {
  readonly provider: string;
  /** Canaux réellement disponibles chez ce prestataire (numéro d'envoi configuré). */
  readonly channels: readonly TextChannel[];
  send(message: TextMessage): Promise<Result<SendOk, SendError>>;
}

export interface EmailSender {
  readonly provider: string;
  send(message: EmailMessage): Promise<Result<SendOk, SendError>>;
}

/** Les envoyeurs choisis au démarrage (null : canal indisponible). */
export interface Senders {
  sms: TextSender | null;
  whatsapp: TextSender | null;
  email: EmailSender | null;
  /** Notifications push de l'appli mobile (canal « app ») ; absent : pas de push. */
  push?: PushSender | null;
}

/** fetch injectable (simulé dans les tests). */
export type Fetch = (
  input: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
    signal?: AbortSignal;
  },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/** Erreur à partir d'une réponse HTTP : 408, 429 et 5xx sont réessayables. */
export function httpError(provider: string, status: number): SendError {
  return {
    kind: "send_failed",
    reason: `${provider}_http_${status}`,
    retryable: status === 408 || status === 429 || status >= 500,
  };
}

export function networkError(provider: string): SendError {
  return {
    kind: "send_failed",
    reason: `${provider}_network`,
    retryable: true,
  };
}

/** Lit un champ texte d'un JSON inconnu. */
export function readString(value: unknown, ...path: string[]): string | null {
  let v: unknown = value;
  for (const key of path) {
    if (Array.isArray(v)) v = v[Number(key)];
    else if (typeof v === "object" && v !== null)
      v = Object.entries(v).find(([k]) => k === key)?.[1];
    else return null;
  }
  return typeof v === "string" ? v : null;
}

/** Appel HTTP avec échéance ; une exception réseau devient une valeur. */
export async function post(
  fetcher: Fetch,
  url: string,
  headers: Record<string, string>,
  body: string,
  timeoutMs = 15_000,
): Promise<
  { reached: true; status: number; json: unknown } | { reached: false }
> {
  try {
    const res = await fetcher(url, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(timeoutMs),
    });
    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    return { reached: true, status: res.status, json };
  } catch {
    return { reached: false };
  }
}

export const basicAuth = (user: string, secret: string) =>
  `Basic ${Buffer.from(`${user}:${secret}`).toString("base64")}`;

/** Fin d'un numéro ou d'une adresse, pour les journaux (jamais en entier). */
export const mask = (address: string) =>
  address.includes("@")
    ? `…@${address.split("@")[1] ?? ""}`
    : `…${address.slice(-2)}`;
