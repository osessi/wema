import type { ChatMessage } from "./types";

// Filet de sécurité : les appelants n'envoient qu'un pseudonyme, mais un
// élève peut écrire son e-mail ou son numéro dans la conversation.
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE = /(?:\+|00)?\d[\d\s.-]{7,}\d/g;

/** Masque les e-mails et numéros de téléphone avant l'envoi à un fournisseur. */
export function scrubPersonalData(text: string): string {
  return text.replace(EMAIL, "[e-mail masqué]").replace(PHONE, (match) =>
    // Un nombre court ou un calcul (ex. 3 000 000) n'est pas un numéro.
    match.replace(/\D/g, "").length >= 9 ? "[numéro masqué]" : match,
  );
}

export function scrubMessages(messages: readonly ChatMessage[]): ChatMessage[] {
  return messages.map((m) => ({
    role: m.role,
    content: scrubPersonalData(m.content),
  }));
}
