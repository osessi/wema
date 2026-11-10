import { err, ok } from "@wema/domain";
import {
  basicAuth,
  type Fetch,
  httpError,
  networkError,
  post,
  readString,
  type TextChannel,
  type TextSender,
} from "./channels";

export interface TwilioConfig {
  accountSid: string;
  /** Jeton du compte, ou secret d'une clé d'API (avec `apiKeySid`). */
  authToken: string;
  apiKeySid?: string | undefined;
  /** Numéro d'envoi des SMS (E.164) ou service de messagerie (MG…). */
  smsFrom?: string | undefined;
  messagingServiceSid?: string | undefined;
  /** Numéro WhatsApp Business (E.164, sans le préfixe « whatsapp: »). */
  whatsappFrom?: string | undefined;
  /** Modèles WhatsApp approuvés (Content API, HX…), facultatifs. */
  whatsappCodeContentSid?: string | undefined;
  whatsappNotificationContentSid?: string | undefined;
  baseUrl?: string | undefined;
}

/**
 * Twilio Programmable Messaging (SMS et WhatsApp) par l'API REST :
 * POST /2010-04-01/Accounts/{sid}/Messages.json, formulaire encodé.
 */
export function createTwilioSender(
  config: TwilioConfig,
  fetcher: Fetch = fetch,
): TextSender {
  const base = config.baseUrl ?? "https://api.twilio.com";
  const url = `${base}/2010-04-01/Accounts/${encodeURIComponent(config.accountSid)}/Messages.json`;
  const channels: TextChannel[] = [];
  if (config.smsFrom || config.messagingServiceSid) channels.push("sms");
  if (config.whatsappFrom) channels.push("whatsapp");
  return {
    provider: "twilio",
    channels,
    async send(message) {
      const form = new URLSearchParams();
      if (message.channel === "whatsapp") {
        if (!config.whatsappFrom)
          return err({
            kind: "send_failed",
            reason: "twilio_no_whatsapp_from",
            retryable: false,
          });
        form.set("To", `whatsapp:${message.to}`);
        form.set("From", `whatsapp:${config.whatsappFrom}`);
        const contentSid =
          message.template?.purpose === "code"
            ? config.whatsappCodeContentSid
            : message.template?.purpose === "notification"
              ? config.whatsappNotificationContentSid
              : undefined;
        if (contentSid && message.template) {
          form.set("ContentSid", contentSid);
          form.set(
            "ContentVariables",
            JSON.stringify(
              Object.fromEntries(
                message.template.variables.map((v, i) => [String(i + 1), v]),
              ),
            ),
          );
        } else {
          form.set("Body", message.body);
        }
      } else {
        form.set("To", message.to);
        if (config.messagingServiceSid)
          form.set("MessagingServiceSid", config.messagingServiceSid);
        else if (config.smsFrom) form.set("From", config.smsFrom);
        else
          return err({
            kind: "send_failed",
            reason: "twilio_no_sms_from",
            retryable: false,
          });
        form.set("Body", message.body);
      }
      const res = await post(
        fetcher,
        url,
        {
          authorization: basicAuth(
            config.apiKeySid ?? config.accountSid,
            config.authToken,
          ),
          "content-type": "application/x-www-form-urlencoded",
          accept: "application/json",
        },
        form.toString(),
      );
      if (!res.reached) return err(networkError("twilio"));
      if (res.status < 200 || res.status >= 300)
        return err(httpError("twilio", res.status));
      return ok({ provider: "twilio", ref: readString(res.json, "sid") });
    },
  };
}
