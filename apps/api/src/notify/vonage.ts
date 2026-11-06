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

export interface VonageConfig {
  apiKey: string;
  apiSecret: string;
  /** Expéditeur des SMS : numéro E.164 ou nom alphanumérique. */
  smsFrom?: string | undefined;
  /** Numéro WhatsApp Business (E.164). */
  whatsappFrom?: string | undefined;
  /** Noms des modèles WhatsApp approuvés, facultatifs. */
  whatsappCodeTemplate?: string | undefined;
  whatsappNotificationTemplate?: string | undefined;
  /** Langue des modèles WhatsApp (code Meta : « fr »…). */
  whatsappTemplateLocale?: string | undefined;
  baseUrl?: string | undefined;
}

/** Vonage attend les numéros sans « + ». */
const digits = (e164: string) => e164.replace(/^\+/, "");

/**
 * Vonage Messages API (SMS et WhatsApp) : POST /v1/messages en JSON, avec
 * l'authentification de base (clé et secret de l'API).
 */
export function createVonageSender(
  config: VonageConfig,
  fetcher: Fetch = fetch,
): TextSender {
  const url = `${config.baseUrl ?? "https://api.nexmo.com"}/v1/messages`;
  const channels: TextChannel[] = [];
  if (config.smsFrom) channels.push("sms");
  if (config.whatsappFrom) channels.push("whatsapp");
  return {
    provider: "vonage",
    channels,
    async send(message) {
      const from =
        message.channel === "whatsapp" ? config.whatsappFrom : config.smsFrom;
      if (!from)
        return err({
          kind: "send_failed",
          reason: `vonage_no_${message.channel}_from`,
          retryable: false,
        });
      const templateName =
        message.channel === "whatsapp"
          ? message.template?.purpose === "code"
            ? config.whatsappCodeTemplate
            : message.template?.purpose === "notification"
              ? config.whatsappNotificationTemplate
              : undefined
          : undefined;
      const parameters = (message.template?.variables ?? []).map((text) => ({
        type: "text",
        text,
      }));
      const payload =
        templateName && message.template
          ? {
              message_type: "custom",
              channel: "whatsapp",
              to: digits(message.to),
              from: digits(from),
              custom: {
                type: "template",
                template: {
                  name: templateName,
                  language: {
                    policy: "deterministic",
                    code: config.whatsappTemplateLocale ?? "fr",
                  },
                  components: [
                    { type: "body", parameters },
                    // Modèle d'authentification : le bouton « copier le code ».
                    ...(message.template.purpose === "code"
                      ? [
                          {
                            type: "button",
                            sub_type: "url",
                            index: "0",
                            parameters: parameters.slice(0, 1),
                          },
                        ]
                      : []),
                  ],
                },
              },
            }
          : {
              message_type: "text",
              channel: message.channel,
              to: digits(message.to),
              from: message.channel === "whatsapp" ? digits(from) : from,
              text: message.body,
            };
      const res = await post(
        fetcher,
        url,
        {
          authorization: basicAuth(config.apiKey, config.apiSecret),
          "content-type": "application/json",
          accept: "application/json",
        },
        JSON.stringify(payload),
      );
      if (!res.reached) return err(networkError("vonage"));
      if (res.status < 200 || res.status >= 300)
        return err(httpError("vonage", res.status));
      return ok({
        provider: "vonage",
        ref: readString(res.json, "message_uuid"),
      });
    },
  };
}
