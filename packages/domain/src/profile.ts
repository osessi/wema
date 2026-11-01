import type { EventId } from "./ids";

// Profil explicable (architecture §2.3) : chaque hypothèse sur la façon
// d'apprendre a une source, une confiance et des preuves (règle n°4).

/** D'où vient une hypothèse. */
export type HypothesisSource =
  | "declared_guardian"
  | "declared_teacher"
  | "declared_learner"
  | "intake"
  | "measured";

/** Préférences et centres d'intérêt reconnus (catalogue fermé ; les intérêts portent un libellé libre). */
export const PREFERENCES = {
  "format.scaffolded": "Comprend mieux avec des étapes guidées",
  "format.examples": "Comprend mieux avec des exemples concrets",
  "format.visual": "Comprend mieux avec des schémas ou des dessins",
  "format.comics": "Aime apprendre avec des bandes dessinées",
  "format.audio": "Comprend mieux à l'oral",
  "pace.short_sessions": "Préfère des séances courtes",
  "confidence.low": "Manque de confiance en lui",
  "confidence.high": "A confiance en lui",
  interest: "Centre d'intérêt",
} as const;

export type PreferenceKey = keyof typeof PREFERENCES;

export function isPreferenceKey(value: string): value is PreferenceKey {
  return Object.hasOwn(PREFERENCES, value);
}

/**
 * Besoins particuliers déclarés (données de santé, RGPD art. 9). Wema ne les
 * repère pas et ne pose aucun diagnostic : ils sont déclarés par un parent ou
 * un prof, avec le consentement du parent. Le prof IA ne reçoit que les
 * adaptations, jamais le besoin lui-même.
 */
export const NEEDS = {
  "need.dyslexia": {
    label: "Dyslexie",
    adaptation:
      "Phrases courtes, vocabulaire simple, pas de texte dense ; reformuler sans s'impatienter.",
  },
  "need.dyscalculia": {
    label: "Dyscalculie",
    adaptation:
      "Décomposer chaque calcul, laisser du temps, commencer par de petits nombres.",
  },
  "need.dyspraxia": {
    label: "Dyspraxie",
    adaptation: "Limiter l'écriture demandée ; accepter des réponses courtes.",
  },
  "need.adhd": {
    label: "Trouble de l'attention (TDAH)",
    adaptation:
      "Une consigne à la fois, échanges courts, encouragements fréquents.",
  },
  "need.other": {
    label: "Autre besoin déclaré",
    adaptation: "Rester patient et vérifier la compréhension à chaque étape.",
  },
} as const;

export type NeedKey = keyof typeof NEEDS;

export function isNeedKey(value: string): value is NeedKey {
  return Object.hasOwn(NEEDS, value);
}

export interface Hypothesis {
  /** Clé de préférence ; pour un centre d'intérêt, `interest:<libellé>`. */
  key: string;
  statement: string;
  sources: readonly HypothesisSource[];
  confidence: number;
  status: "supported" | "contradicted" | "uncertain";
  evidence: readonly EventId[];
}

// Les besoins de santé ne sont jamais déduits ni écrits en texte libre : un
// libellé (centre d'intérêt, résumé) qui en évoque un est refusé ou retiré.
const HEALTH_TERMS =
  /dys(lexi|calcul|prax|orthograph|phasi)|tdah|hyperacti|trouble|handicap|diagnosti|autis|\btsa\b|\bhpi\b|haut potentiel|surdou|épilep|epilep|anxi|dépress|depress|\btoc\b|déficit|deficit|maladie|médic|medic|patholog|thérap|therap/i;

export function containsHealthTerm(text: string): boolean {
  return HEALTH_TERMS.test(text);
}

/** Libellé d'un centre d'intérêt : quelques mots, lettres seulement (aucune consigne possible). */
export function isSafeInterestLabel(label: string): boolean {
  return (
    /^[\p{L}][\p{L}\s'-]{0,39}$/u.test(label.trim()) &&
    !containsHealthTerm(label)
  );
}
