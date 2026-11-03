/**
 * Apprentissage collectif anonymisé : règles pures qui transforment des
 * effectifs bruts (calculés en SQL sur tous les élèves, toutes organisations)
 * en agrégats publiables. Règle d'anonymat (k-anonymat) : un groupe d'élèves
 * n'est publié que s'il compte au moins `minLearners` élèves distincts ; sinon
 * il disparaît, sans valeur approchée.
 */

/** Seuil minimal d'effectif ; un calcul ne peut pas descendre en dessous. */
export const COLLECTIVE_MIN_LEARNERS = 10;

/** Nombre maximal d'idées fausses et d'exercices gardés par notion. */
const TOP = 5;

export interface RawNotionStats {
  notionId: string;
  learners: number;
  answers: number;
  correct: number;
  /** Élèves avec au moins 3 réponses, aucune juste parmi les 3 dernières. */
  stuck: number;
  /** Élèves qui ont fini par réussir, et nombre moyen de réponses fausses avant. */
  succeededLearners: number;
  avgAnswersBeforeSuccess: number | null;
}

export interface RawMisconceptionStats {
  notionId: string;
  misconceptionId: string;
  description: string;
  learners: number;
}

/** Réponses d'un groupe (format ou exercice) et la réponse suivante sur la même notion. */
export interface RawProgressStats {
  notionId: string;
  learners: number;
  answers: number;
  correct: number;
  /** Réponses suivies d'une autre réponse, et combien de ces suivantes sont justes. */
  followed: number;
  nextCorrect: number;
}

export interface RawFormatStats extends RawProgressStats {
  format: string;
  scaffolded: boolean | null;
}

export interface RawExerciseStats extends RawProgressStats {
  intentId: string;
  objective: string;
}

export interface RawTutorStats {
  notionId: string;
  learners: number;
  avgSeconds: number;
}

export interface RawCollectiveData {
  notions: readonly RawNotionStats[];
  misconceptions: readonly RawMisconceptionStats[];
  formats: readonly RawFormatStats[];
  exercises: readonly RawExerciseStats[];
  tutor: readonly RawTutorStats[];
}

export interface MisconceptionInsight {
  misconceptionId: string;
  description: string;
  learners: number;
  /** Part des élèves de la notion concernés, de 0 à 1. */
  share: number;
}

interface ProgressInsight {
  learners: number;
  answers: number;
  successRate: number;
  /** Réussite de la réponse suivante sur la notion (null : trop peu d'élèves suivis). */
  nextSuccessRate: number | null;
  /** Écart avec la réussite de la réponse suivante, tous formats confondus. */
  gain: number | null;
}

export interface FormatInsight extends ProgressInsight {
  format: string;
  scaffolded: boolean | null;
}

export interface ExerciseInsight extends ProgressInsight {
  intentId: string;
  objective: string;
}

export interface NotionInsight {
  notionId: string;
  learners: number;
  answers: number;
  successRate: number;
  stuckRate: number;
  avgAnswersToSuccess: number | null;
  avgTutorSeconds: number | null;
  misconceptions: MisconceptionInsight[];
  formats: FormatInsight[];
  exercises: ExerciseInsight[];
}

const ratio = (n: number, d: number) => (d > 0 ? n / d : 0);
const round = (x: number, digits = 3) => {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
};

/** Seuil effectif : jamais en dessous du minimum, quelle que soit la demande. */
export function effectiveMinLearners(requested?: number): number {
  return Math.max(
    COLLECTIVE_MIN_LEARNERS,
    Math.floor(requested ?? COLLECTIVE_MIN_LEARNERS),
  );
}

/**
 * Agrégats publiables, notion par notion. Une notion, une idée fausse, un
 * format ou un exercice qui concerne moins de `minLearners` élèves n'apparaît pas.
 */
export function buildCollectiveInsights(
  raw: RawCollectiveData,
  requestedMinLearners?: number,
): NotionInsight[] {
  const k = effectiveMinLearners(requestedMinLearners);
  const groupBy = <T extends { notionId: string }>(rows: readonly T[]) => {
    const map = new Map<string, T[]>();
    for (const r of rows)
      map.set(r.notionId, [...(map.get(r.notionId) ?? []), r]);
    return map;
  };
  const misconceptions = groupBy(raw.misconceptions);
  const formats = groupBy(raw.formats);
  const exercises = groupBy(raw.exercises);
  const tutor = new Map(raw.tutor.map((t) => [t.notionId, t]));

  return raw.notions
    .filter((n) => n.learners >= k)
    .map((n) => {
      const all = [...(formats.get(n.notionId) ?? [])];
      const baseline = ratio(
        all.reduce((s, f) => s + f.nextCorrect, 0),
        all.reduce((s, f) => s + f.followed, 0),
      );
      const progress = (g: RawProgressStats): ProgressInsight => {
        const next = g.followed > 0 ? ratio(g.nextCorrect, g.followed) : null;
        return {
          learners: g.learners,
          answers: g.answers,
          successRate: round(ratio(g.correct, g.answers)),
          nextSuccessRate: next === null ? null : round(next),
          gain: next === null ? null : round(next - baseline),
        };
      };
      const t = tutor.get(n.notionId);
      return {
        notionId: n.notionId,
        learners: n.learners,
        answers: n.answers,
        successRate: round(ratio(n.correct, n.answers)),
        stuckRate: round(ratio(n.stuck, n.learners)),
        avgAnswersToSuccess:
          n.succeededLearners >= k && n.avgAnswersBeforeSuccess !== null
            ? round(n.avgAnswersBeforeSuccess + 1, 1)
            : null,
        avgTutorSeconds: t && t.learners >= k ? Math.round(t.avgSeconds) : null,
        misconceptions: (misconceptions.get(n.notionId) ?? [])
          .filter((m) => m.learners >= k)
          .sort((a, b) => b.learners - a.learners)
          .slice(0, TOP)
          .map((m) => ({
            misconceptionId: m.misconceptionId,
            description: m.description,
            learners: m.learners,
            share: round(ratio(m.learners, n.learners)),
          })),
        formats: all
          .filter((f) => f.learners >= k)
          .map((f) => ({
            format: f.format,
            scaffolded: f.scaffolded,
            ...progress(f),
          }))
          .sort((a, b) => (b.gain ?? -1) - (a.gain ?? -1)),
        exercises: (exercises.get(n.notionId) ?? [])
          .filter((e) => e.learners >= k)
          .map((e) => ({
            intentId: e.intentId,
            objective: e.objective,
            ...progress(e),
          }))
          .sort((a, b) => (b.gain ?? -1) - (a.gain ?? -1))
          .slice(0, TOP),
      };
    });
}

/**
 * Ce que le cœur peut lire d'une notion pour choisir la forme d'un exercice :
 * l'avantage des étapes guidées sur la réponse suivante (réussite après une
 * variante guidée moins réussite après une variante non guidée), ou null si
 * l'un des deux groupes manque.
 */
export function scaffoldingGain(
  insight: Pick<NotionInsight, "formats"> | null,
): number | null {
  if (!insight) return null;
  const rate = (scaffolded: boolean) => {
    const groups = insight.formats.filter(
      (f) => f.scaffolded === scaffolded && f.nextSuccessRate !== null,
    );
    const weight = groups.reduce((s, f) => s + f.answers, 0);
    if (weight === 0) return null;
    return (
      groups.reduce((s, f) => s + (f.nextSuccessRate ?? 0) * f.answers, 0) /
      weight
    );
  };
  const guided = rate(true);
  const plain = rate(false);
  return guided === null || plain === null ? null : round(guided - plain);
}
