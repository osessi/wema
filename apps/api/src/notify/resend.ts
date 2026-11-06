import { err, ok } from "@wema/domain";
import {
  type EmailSender,
  type Fetch,
  httpError,
  networkError,
  post,
  readString,
} from "./channels";

export interface ResendConfig {
  apiKey: string;
  /** Expéditeur vérifié chez Resend, par ex. « Wema <bonjour@exemple.org> ». */
  from: string;
  replyTo?: string | undefined;
  baseUrl?: string | undefined;
}

/** Resend : POST /emails en JSON, jeton porteur. */
export function createResendSender(
  config: ResendConfig,
  fetcher: Fetch = fetch,
): EmailSender {
  const url = `${config.baseUrl ?? "https://api.resend.com"}/emails`;
  return {
    provider: "resend",
    async send(message) {
      const headers: Record<string, string> = {};
      if (message.unsubscribeUrl) {
        headers["List-Unsubscribe"] = `<${message.unsubscribeUrl}>`;
        headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
      }
      const res = await post(
        fetcher,
        url,
        {
          authorization: `Bearer ${config.apiKey}`,
          "content-type": "application/json",
          accept: "application/json",
        },
        JSON.stringify({
          from: config.from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          html: message.html,
          ...(config.replyTo ? { reply_to: config.replyTo } : {}),
          ...(Object.keys(headers).length > 0 ? { headers } : {}),
        }),
      );
      if (!res.reached) return err(networkError("resend"));
      if (res.status < 200 || res.status >= 300)
        return err(httpError("resend", res.status));
      return ok({ provider: "resend", ref: readString(res.json, "id") });
    },
  };
}
