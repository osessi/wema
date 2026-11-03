import type {
  Hypothesis,
  LearningEvent,
  NeedKey,
  PresentationFormat,
} from "@wema/domain";
import { PRESENTATION_FORMATS } from "@wema/domain";

// Choix du format de présentation d'une variante (architecture §2.4). Le
// format change la façon de lire l'énoncé, jamais ce qui est évalué : il est
// choisi APRÈS la variante (planVariant et generateVariant n'en dépendent pas),
// au moment de la servir, avec le profil du moment.
//
// Trois sources, par ordre de poids croissant :
// 1. les hypothèses du profil (préférences déclarées, entretien), pondérées par
//    leur confiance ; une hypothèse démentie pénalise le format ;
// 2. les adaptations qui découlent d'un besoin déclaré et consenti (jamais le
//    besoin lui-même dans la raison donnée) ;
// 3. la mesure : taux de réussite au premier essai dans chaque format, dès
//    qu'il y a assez de réponses. C'est « le système qui apprend ce qui marche ».

/** Préférences du profil qui plaident pour un format (donnée, pas de cas particulier). */
export const FORMAT_PREFERENCES: Readonly<
  Record<PresentationFormat, readonly string[]>
> = {
  text: [],
  easy_reading: [],
  diagram: ["format.visual"],
  comics: ["format.comics"],
  audio: ["format.audio"],
};

/** Adaptations de présentation qui découlent d'un besoin déclaré (fiche 0006). */
export const NEED_FORMATS: Readonly<
  Partial<Record<NeedKey, PresentationFormat>>
> = {
  "need.dyslexia": "easy_reading",
};

/** Réponses au premier essai à partir desquelles un format est jugé sur sa mesure. */
export const MIN_FORMAT_SAMPLES = 5;
/** Réponses à partir desquelles la mesure pèse de tout son poids. */
const FULL_WEIGHT_SAMPLES = 20;
/** Poids d'un écart de réussite mesuré (un écart de 0,25 vaut une préférence déclarée sûre). */
const MEASURE_WEIGHT = 2;
/** Poids d'une adaptation liée à un besoin déclaré. */
const NEED_WEIGHT = 0.6;
/** Le texte simple sert de format par défaut. */
const DEFAULT_SCORE = 0.1;

export interface FormatOutcome {
  attempts: number;
  correct: number;
}

/** Réponses au premier essai (seules dans le journal) par format présenté. */
export function measureFormats(
  events: readonly LearningEvent[],
): Partial<Record<PresentationFormat, FormatOutcome>> {
  const out: Partial<Record<PresentationFormat, FormatOutcome>> = {};
  for (const e of events) {
    const p = e.payload;
    if (p.type !== "answer.submitted" || !p.format) continue;
    const o = out[p.format] ?? { attempts: 0, correct: 0 };
    o.attempts++;
    if (p.correct) o.correct++;
    out[p.format] = o;
  }
  return out;
}

/** Taux de réussite lissé (on part de 1 sur 2). */
const rate = (o: FormatOutcome) => (o.correct + 1) / (o.attempts + 2);

export type FormatReason =
  /** Rien ne plaide pour un autre format. */
  | "default"
  /** Une préférence du profil (déclarée ou issue de l'entretien). */
  | "preference"
  /** Une adaptation demandée pour l'élève (sans dire laquelle ni pourquoi). */
  | "adaptation"
  /** L'élève réussit mieux dans ce format. */
  | "measured";

export interface FormatScore {
  format: PresentationFormat;
  score: number;
  /** Ce qui a pesé, pour expliquer le choix (profil explicable). */
  preference: number;
  adaptation: number;
  measured: number;
  outcome: FormatOutcome | null;
}

export interface PresentationChoice {
  format: PresentationFormat;
  reason: FormatReason;
  /** Formats proposés à l'élève, du plus recommandé au moins recommandé. */
  ranking: FormatScore[];
}

/**
 * Format recommandé pour présenter une variante. `available` dit ce qui peut
 * être produit pour cet exercice (pas de schéma sans gabarit de figure, pas de
 * BD sans IA) ; le texte est toujours possible.
 */
export function choosePresentation(input: {
  available: readonly PresentationFormat[];
  hypotheses: readonly Hypothesis[];
  outcomes: Partial<Record<PresentationFormat, FormatOutcome>>;
  /** Besoins déclarés, actifs et consentis. */
  needs?: readonly NeedKey[];
}): PresentationChoice {
  const formats = PRESENTATION_FORMATS.filter(
    (f) => f === "text" || input.available.includes(f),
  );
  const adapted = new Set(
    (input.needs ?? []).flatMap((n) => {
      const f = NEED_FORMATS[n];
      return f ? [f] : [];
    }),
  );
  const outcomes = input.outcomes;
  const total = (except: PresentationFormat): FormatOutcome => {
    const sum = { attempts: 0, correct: 0 };
    for (const [f, o] of Object.entries(outcomes)) {
      if (f === except || !o) continue;
      sum.attempts += o.attempts;
      sum.correct += o.correct;
    }
    return sum;
  };

  const ranking = formats.map((format): FormatScore => {
    let preference = 0;
    for (const key of FORMAT_PREFERENCES[format]) {
      const h = input.hypotheses.find((x) => x.key === key);
      if (!h) continue;
      if (h.status === "supported") preference += h.confidence;
      else if (h.status === "contradicted") preference -= h.confidence;
    }
    const adaptation = adapted.has(format) ? NEED_WEIGHT : 0;
    const outcome = outcomes[format] ?? null;
    const others = total(format);
    let measured = 0;
    // On ne compare que si ce format ET les autres ont assez de réponses.
    if (
      outcome &&
      outcome.attempts >= MIN_FORMAT_SAMPLES &&
      others.attempts >= MIN_FORMAT_SAMPLES
    ) {
      const weight = Math.min(
        1,
        Math.min(outcome.attempts, others.attempts) / FULL_WEIGHT_SAMPLES,
      );
      measured = MEASURE_WEIGHT * weight * (rate(outcome) - rate(others));
    }
    const base = format === "text" ? DEFAULT_SCORE : 0;
    const round = (n: number) => Math.round(n * 1000) / 1000;
    return {
      format,
      score: round(base + preference + adaptation + measured),
      preference: round(preference),
      adaptation: round(adaptation),
      measured: round(measured),
      outcome,
    };
  });
  // Ordre stable : à score égal, l'ordre du catalogue (le texte d'abord).
  ranking.sort((a, b) => b.score - a.score);
  const best = ranking[0];
  if (!best) return { format: "text", reason: "default", ranking };
  if (best.format === "text")
    return {
      format: "text",
      reason: best.measured > 0 ? "measured" : "default",
      ranking,
    };
  // La raison : ce qui a le plus pesé pour le format retenu.
  const reasons: [FormatReason, number][] = [
    ["measured", best.measured],
    ["adaptation", best.adaptation],
    ["preference", best.preference],
  ];
  reasons.sort((a, b) => b[1] - a[1]);
  return {
    format: best.format,
    reason: reasons[0]?.[0] ?? "default",
    ranking,
  };
}
