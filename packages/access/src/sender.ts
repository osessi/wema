import type { Result } from "@wema/domain";
import { ok } from "@wema/domain";

export type CodeChannel = "sms" | "whatsapp";

export interface CodeMessage {
  channel: CodeChannel;
  /** Numéro E.164. */
  to: string;
  code: string;
}

/** Envoi d'un code de connexion ; le prestataire réel sera choisi plus tard. */
export interface CodeSender {
  send(
    message: CodeMessage,
  ): Promise<Result<void, { kind: "send_failed"; reason: string }>>;
}

/**
 * Envoyeur de développement : garde les messages en mémoire au lieu de les
 * envoyer. Réservé au développement local et aux tests.
 */
export function createMemoryCodeSender(): CodeSender & { sent: CodeMessage[] } {
  const sent: CodeMessage[] = [];
  return {
    sent,
    async send(message) {
      sent.push(message);
      return ok(undefined);
    },
  };
}
