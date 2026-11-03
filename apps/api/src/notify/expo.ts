import { err, ok, type Result } from "@wema/domain";
import {
  type Fetch,
  httpError,
  networkError,
  post,
  readString,
  type SendError,
} from "./channels";

/**
 * Notifications push de l'appli mobile par le service d'Expo (API HTTP,
 * https://docs.expo.dev/push-notifications/sending-notifications/). Aucun
 * compte n'est nécessaire ; `EXPO_ACCESS_TOKEN` (facultatif) active la
 * « sécurité renforcée des envois » du projet expo.dev.
 */

const SEND_URL = "https://exp.host/--/api/v2/push/send";
const RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";
/** Limites d'Expo : 100 messages par envoi, 1000 reçus par lecture. */
export const EXPO_SEND_BATCH = 100;
export const EXPO_RECEIPTS_BATCH = 1000;

export interface PushMessage {
  /** Jeton Expo de l'appareil. */
  to: string;
  title: string;
  body: string;
  /** Données lues par l'appli à l'ouverture (chemin de la page). */
  data?: Record<string, string>;
}

/** Réponse d'Expo pour un message : un ticket, ou une erreur immédiate. */
export type PushTicket =
  | { to: string; ok: true; id: string }
  | { to: string; ok: false; error: string };

/** Reçu d'un ticket (quelques minutes après) : livré au service d'Apple ou de Google, ou erreur. */
export type PushReceipt = { ok: true } | { ok: false; error: string };

export interface PushSender {
  readonly provider: string;
  send(messages: PushMessage[]): Promise<Result<PushTicket[], SendError>>;
  receipts(ids: string[]): Promise<Result<Map<string, PushReceipt>, SendError>>;
}

/** Erreur Expo qui signifie que l'appareil ne reçoit plus rien : jeton à retirer. */
export const DEVICE_NOT_REGISTERED = "DeviceNotRegistered";

function headers(accessToken: string | undefined): Record<string, string> {
  const h: Record<string, string> = {
    accept: "application/json",
    "content-type": "application/json",
  };
  if (accessToken) h.authorization = `Bearer ${accessToken}`;
  return h;
}

/** Code court d'une erreur Expo (jamais le message brut). */
function errorCode(entry: unknown): string {
  const code =
    readString(entry, "details", "error") ?? readString(entry, "status");
  return code && /^[A-Za-z_]{1,40}$/.test(code) ? code : "expo_error";
}

export function createExpoPushSender(
  config: { accessToken?: string | undefined },
  fetcher: Fetch,
): PushSender {
  return {
    provider: "expo",
    async send(messages) {
      const tickets: PushTicket[] = [];
      for (let i = 0; i < messages.length; i += EXPO_SEND_BATCH) {
        const batch = messages.slice(i, i + EXPO_SEND_BATCH);
        const res = await post(
          fetcher,
          SEND_URL,
          headers(config.accessToken),
          JSON.stringify(
            batch.map((m) => ({
              to: m.to,
              title: m.title,
              body: m.body,
              sound: "default",
              ...(m.data ? { data: m.data } : {}),
            })),
          ),
        );
        if (!res.reached) return err(networkError("expo"));
        if (res.status >= 300) return err(httpError("expo", res.status));
        const data =
          typeof res.json === "object" &&
          res.json !== null &&
          "data" in res.json
            ? res.json.data
            : null;
        if (!Array.isArray(data) || data.length !== batch.length)
          return err({
            kind: "send_failed",
            reason: "expo_bad_response",
            retryable: false,
          });
        batch.forEach((m, k) => {
          const entry: unknown = data[k];
          const id = readString(entry, "id");
          tickets.push(
            readString(entry, "status") === "ok" && id
              ? { to: m.to, ok: true, id }
              : { to: m.to, ok: false, error: errorCode(entry) },
          );
        });
      }
      return ok(tickets);
    },

    async receipts(ids) {
      const out = new Map<string, PushReceipt>();
      for (let i = 0; i < ids.length; i += EXPO_RECEIPTS_BATCH) {
        const batch = ids.slice(i, i + EXPO_RECEIPTS_BATCH);
        const res = await post(
          fetcher,
          RECEIPTS_URL,
          headers(config.accessToken),
          JSON.stringify({ ids: batch }),
        );
        if (!res.reached) return err(networkError("expo"));
        if (res.status >= 300) return err(httpError("expo", res.status));
        const data =
          typeof res.json === "object" &&
          res.json !== null &&
          "data" in res.json
            ? res.json.data
            : null;
        if (typeof data !== "object" || data === null) continue;
        for (const [id, entry] of Object.entries(data)) {
          out.set(
            id,
            readString(entry, "status") === "ok"
              ? { ok: true }
              : { ok: false, error: errorCode(entry) },
          );
        }
      }
      return ok(out);
    },
  };
}
