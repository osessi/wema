import type { ChatMessage } from "./types";

// Filet de sécurité : les appelants n'envoient qu'un pseudonyme, mais un
// élève peut écrire son e-mail ou son numéro dans la conversation. Un numéro
// n'est reconnu qu'à son contexte, sans supposer le format d'un pays
// (AGENTS.md, règle 8), pour ne jamais abîmer un énoncé de maths.

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

/** Indicatif international : « + » ou « 00 », un indicatif qui ne commence pas par 0, puis 6 à 13 chiffres. */
const INTERNATIONAL = /(?:\+|\b00)[1-9]\d{0,2}(?:[\s.-]?\d){6,13}\b/g;

/** Mot qui annonce un numéro, suivi du numéro (6 à 15 chiffres, séparés ou non). */
const ANNOUNCED =
  /(\b(?:num[ée]ro|n°|t[ée]l(?:[ée]phone)?|whatsapp|portable|mobile|joignable|appelle[- ]?moi)\b[^\d\n]{0,20})(\d(?:[\s.-]?\d){5,14})/gi;

/**
 * Groupes réguliers de deux chiffres (« 90 12 34 56 », « 06-12-34-56-78 »,
 * « 97.12.34.56 ») : forme habituelle d'un numéro sur de nombreux marchés,
 * jamais celle d'un nombre (les milliers vont par trois, les décimales n'ont
 * qu'un séparateur).
 */
const PAIRS = /\b\d{2}(?:([\s.-])\d{2})(?:\1\d{2}){2,4}\b/g;

const MASK = "[numéro masqué]";

/** Masque les e-mails et numéros de téléphone avant l'envoi à un fournisseur. */
export function scrubPersonalData(text: string): string {
  return text
    .replace(EMAIL, "[e-mail masqué]")
    .replace(INTERNATIONAL, MASK)
    .replace(ANNOUNCED, (_match, lead: string) => `${lead}${MASK}`)
    .replace(PAIRS, MASK);
}

/**
 * Seuls les messages de l'élève sont filtrés : les consignes et les énoncés
 * (messages système, réponses du prof IA) restent intacts.
 */
export function scrubMessages(messages: readonly ChatMessage[]): ChatMessage[] {
  return messages.map((m) => ({
    role: m.role,
    content: m.role === "user" ? scrubPersonalData(m.content) : m.content,
    // Une image n'est pas filtrable ici : l'appelant n'envoie que la copie, jamais un document d'identité.
    ...(m.role === "user" && m.images && m.images.length > 0
      ? { images: m.images }
      : {}),
  }));
}
