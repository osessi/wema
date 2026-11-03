import { CODE_TTL_MS, type CodeSender } from "@wema/access";
import { err, ok } from "@wema/domain";
import { z } from "zod";
import {
  type EmailSender,
  type Fetch,
  mask,
  type Senders,
  type TextChannel,
  type TextSender,
} from "./channels";
import { createExpoPushSender } from "./expo";
import { createResendSender } from "./resend";
import { createTwilioSender } from "./twilio";
import { createVonageSender } from "./vonage";

const optional = z
  .string()
  .optional()
  .transform((v) => (v === undefined || v.trim() === "" ? undefined : v));

/** Variables d'environnement des envois (toutes facultatives, cf. .env.example). */
const notifyEnvSchema = z.object({
  TWILIO_ACCOUNT_SID: optional,
  TWILIO_AUTH_TOKEN: optional,
  TWILIO_API_KEY_SID: optional,
  TWILIO_SMS_FROM: optional,
  TWILIO_MESSAGING_SERVICE_SID: optional,
  TWILIO_WHATSAPP_FROM: optional,
  TWILIO_WHATSAPP_CODE_CONTENT_SID: optional,
  TWILIO_WHATSAPP_NOTIFICATION_CONTENT_SID: optional,
  VONAGE_API_KEY: optional,
  VONAGE_API_SECRET: optional,
  VONAGE_SMS_FROM: optional,
  VONAGE_WHATSAPP_FROM: optional,
  VONAGE_WHATSAPP_CODE_TEMPLATE: optional,
  VONAGE_WHATSAPP_NOTIFICATION_TEMPLATE: optional,
  VONAGE_WHATSAPP_TEMPLATE_LOCALE: optional,
  /** Prestataire préféré par canal quand les deux sont configurés. */
  WEMA_SMS_PROVIDER: z.enum(["twilio", "vonage"]).optional(),
  WEMA_WHATSAPP_PROVIDER: z.enum(["twilio", "vonage"]).optional(),
  RESEND_API_KEY: optional,
  WEMA_EMAIL_FROM: optional,
  WEMA_EMAIL_REPLY_TO: optional,
  /** Push Expo : facultatif (sécurité renforcée des envois sur expo.dev). */
  EXPO_ACCESS_TOKEN: optional,
});

export type NotifyEnv = z.infer<typeof notifyEnvSchema>;

/** Envoyeur de développement : affiche le message (adresse masquée) dans la console. */
export function createConsoleSenders(
  log: (line: string) => void = console.info,
): { sms: TextSender; whatsapp: TextSender; email: EmailSender } {
  const text = (channel: TextChannel): TextSender => ({
    provider: "console",
    channels: [channel],
    async send(m) {
      log(`[dev] ${m.channel} pour ${mask(m.to)} : ${m.body}`);
      return ok({ provider: "console", ref: null });
    },
  });
  return {
    sms: text("sms"),
    whatsapp: text("whatsapp"),
    email: {
      provider: "console",
      async send(m) {
        log(`[dev] e-mail pour ${mask(m.to)} : ${m.subject}\n${m.text}`);
        return ok({ provider: "console", ref: null });
      },
    },
  };
}

/**
 * Choisit les envoyeurs selon les variables d'environnement. Sans prestataire
 * pour un canal : la console en développement, rien (canal indisponible) en
 * production.
 */
export function createSenders(
  env: NodeJS.ProcessEnv,
  options: { production: boolean; fetch?: Fetch },
): { senders: Senders; problems: string[] } {
  const parsed = notifyEnvSchema.safeParse(env);
  if (!parsed.success)
    return {
      senders: { sms: null, whatsapp: null, email: null, push: null },
      problems: [z.prettifyError(parsed.error)],
    };
  const e = parsed.data;
  const fetcher = options.fetch ?? fetch;
  const problems: string[] = [];

  const twilio =
    e.TWILIO_ACCOUNT_SID && e.TWILIO_AUTH_TOKEN
      ? createTwilioSender(
          {
            accountSid: e.TWILIO_ACCOUNT_SID,
            authToken: e.TWILIO_AUTH_TOKEN,
            apiKeySid: e.TWILIO_API_KEY_SID,
            smsFrom: e.TWILIO_SMS_FROM,
            messagingServiceSid: e.TWILIO_MESSAGING_SERVICE_SID,
            whatsappFrom: e.TWILIO_WHATSAPP_FROM,
            whatsappCodeContentSid: e.TWILIO_WHATSAPP_CODE_CONTENT_SID,
            whatsappNotificationContentSid:
              e.TWILIO_WHATSAPP_NOTIFICATION_CONTENT_SID,
          },
          fetcher,
        )
      : null;
  const vonage =
    e.VONAGE_API_KEY && e.VONAGE_API_SECRET
      ? createVonageSender(
          {
            apiKey: e.VONAGE_API_KEY,
            apiSecret: e.VONAGE_API_SECRET,
            smsFrom: e.VONAGE_SMS_FROM,
            whatsappFrom: e.VONAGE_WHATSAPP_FROM,
            whatsappCodeTemplate: e.VONAGE_WHATSAPP_CODE_TEMPLATE,
            whatsappNotificationTemplate:
              e.VONAGE_WHATSAPP_NOTIFICATION_TEMPLATE,
            whatsappTemplateLocale: e.VONAGE_WHATSAPP_TEMPLATE_LOCALE,
          },
          fetcher,
        )
      : null;

  const pick = (
    channel: TextChannel,
    preferred: "twilio" | "vonage" | undefined,
  ): TextSender | null => {
    const candidates = [twilio, vonage].filter(
      (s): s is TextSender => s?.channels.includes(channel) === true,
    );
    if (preferred && !candidates.some((s) => s.provider === preferred))
      problems.push(
        `WEMA_${channel.toUpperCase()}_PROVIDER=${preferred} : ce prestataire n'est pas configuré pour ce canal.`,
      );
    return (
      candidates.find((s) => s.provider === preferred) ?? candidates[0] ?? null
    );
  };

  const email =
    e.RESEND_API_KEY && e.WEMA_EMAIL_FROM
      ? createResendSender(
          {
            apiKey: e.RESEND_API_KEY,
            from: e.WEMA_EMAIL_FROM,
            replyTo: e.WEMA_EMAIL_REPLY_TO,
          },
          fetcher,
        )
      : null;
  if (e.RESEND_API_KEY && !e.WEMA_EMAIL_FROM)
    problems.push("RESEND_API_KEY sans WEMA_EMAIL_FROM : e-mail désactivé.");

  // Push : le service d'Expo ne demande pas de compte, il est donc toujours
  // actif (il ne sert que si un appareil a enregistré son jeton).
  const real: Senders = {
    sms: pick("sms", e.WEMA_SMS_PROVIDER),
    whatsapp: pick("whatsapp", e.WEMA_WHATSAPP_PROVIDER),
    email,
    push: createExpoPushSender({ accessToken: e.EXPO_ACCESS_TOKEN }, fetcher),
  };
  if (options.production) return { senders: real, problems };
  const dev = createConsoleSenders();
  return {
    senders: {
      sms: real.sms ?? dev.sms,
      whatsapp: real.whatsapp ?? dev.whatsapp,
      email: real.email ?? dev.email,
      push: real.push ?? null,
    },
    problems,
  };
}

/** Texte du code de connexion (court : il tient dans un SMS). */
export function codeText(code: string): string {
  const minutes = Math.round(CODE_TTL_MS / 60_000);
  return `Wema : votre code de connexion est ${code}. Il expire dans ${minutes} minutes. Ne le communiquez à personne.`;
}

/** Codes de connexion par SMS ou WhatsApp, selon le canal choisi par l'utilisateur. */
export function createCodeSender(senders: Senders): CodeSender {
  return {
    async send(message) {
      const sender = senders[message.channel];
      if (!sender)
        return err({
          kind: "send_failed",
          reason: `aucun prestataire ${message.channel}`,
        });
      const sent = await sender.send({
        channel: message.channel,
        to: message.to,
        body: codeText(message.code),
        template: { purpose: "code", variables: [message.code] },
      });
      if (!sent.ok)
        return err({ kind: "send_failed", reason: sent.error.reason });
      return ok(undefined);
    },
  };
}
