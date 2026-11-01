import type {
  DeclaredNeed,
  EventId,
  Hypothesis,
  HypothesisSource,
  LearningEvent,
  NotionId,
  PreferenceKey,
} from "@wema/domain";
import { PREFERENCES } from "@wema/domain";

/** Confiance de départ selon la source : la mesure seule peut aller au-delà. */
export const SOURCE_CONFIDENCE: Record<
  Exclude<HypothesisSource, "measured">,
  number
> = {
  declared_guardian: 0.5,
  declared_teacher: 0.5,
  declared_learner: 0.4,
  intake: 0.35,
};

/** Réponses nécessaires de chaque côté (avec et sans étapes guidées) avant de mesurer. */
export const MIN_MEASURED_ANSWERS = 4;
/** Écart de taux de réussite à partir duquel la mesure tranche. */
export const MEASURE_THRESHOLD = 0.2;

export interface TutorAssessmentSummary {
  notionId: NotionId;
  kind: "teach_back" | "oral_check";
  understanding: number;
  confidence: number;
  summary: string;
  evidence: EventId;
}

export interface LearnerProfileProjection {
  hypotheses: Hypothesis[];
  /** Besoins déclarés (données de santé) : accès restreint. */
  needs: DeclaredNeed[];
  assessments: TutorAssessmentSummary[];
}

interface Draft {
  key: string;
  statement: string;
  sources: Set<HypothesisSource>;
  confidence: number;
  status: Hypothesis["status"];
  evidence: EventId[];
}

const keyOf = (key: PreferenceKey, label: string | null) =>
  key === "interest" ? `interest:${(label ?? "").trim().toLowerCase()}` : key;
const statementOf = (key: PreferenceKey, label: string | null) =>
  key === "interest"
    ? `${PREFERENCES.interest} : ${label ?? ""}`
    : PREFERENCES[key];

/**
 * Hypothèses sur la façon d'apprendre, recalculées à partir du journal
 * (fonction pure). Une déclaration ou l'entretien ouvrent une hypothèse avec
 * une confiance modérée ; la dernière déclaration d'une même source l'emporte ;
 * la mesure (réussite avec et sans étapes guidées) confirme ou contredit.
 */
export function projectHypotheses(
  events: readonly LearningEvent[],
): LearnerProfileProjection {
  const sorted = [...events].sort(
    (a, b) =>
      a.occurredAt.getTime() - b.occurredAt.getTime() ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  const drafts = new Map<string, Draft>();
  const needs = new Map<string, DeclaredNeed>();
  const assessments: TutorAssessmentSummary[] = [];
  const scaffold = {
    with: { n: 0, ok: 0, ids: [] as EventId[] },
    without: { n: 0, ok: 0, ids: [] as EventId[] },
  };

  const open = (key: string, statement: string): Draft => {
    const existing = drafts.get(key);
    if (existing) return existing;
    const draft: Draft = {
      key,
      statement,
      sources: new Set(),
      confidence: 0,
      status: "uncertain",
      evidence: [],
    };
    drafts.set(key, draft);
    return draft;
  };

  for (const event of sorted) {
    const p = event.payload;
    if (p.type === "preference.declared") {
      const source: HypothesisSource = `declared_${p.source}`;
      const draft = open(keyOf(p.key, p.label), statementOf(p.key, p.label));
      draft.sources.add(source);
      draft.evidence.push(event.id);
      draft.confidence = Math.max(draft.confidence, SOURCE_CONFIDENCE[source]);
      draft.status = p.value ? "supported" : "contradicted";
    } else if (p.type === "intake.completed") {
      for (const h of p.hypotheses) {
        const draft = open(keyOf(h.key, h.label), statementOf(h.key, h.label));
        draft.sources.add("intake");
        draft.evidence.push(event.id);
        // Une impression d'entretien ne vaut pas une déclaration : confiance plafonnée.
        draft.confidence = Math.max(
          draft.confidence,
          Math.min(h.confidence, SOURCE_CONFIDENCE.intake),
        );
        if (draft.status === "uncertain") draft.status = "supported";
      }
    } else if (p.type === "need.declared") {
      const previous = needs.get(p.need);
      needs.set(p.need, {
        need: p.need,
        active: p.active,
        declaredBy: p.source,
        evidence: [...(previous?.evidence ?? []), event.id],
      });
    } else if (
      p.type === "teachback.assessed" ||
      p.type === "oralcheck.assessed"
    ) {
      assessments.push({
        notionId: p.notionId,
        kind: p.type === "teachback.assessed" ? "teach_back" : "oral_check",
        understanding: p.understanding,
        confidence: p.confidence,
        summary: p.summary,
        evidence: event.id,
      });
    } else if (p.type === "answer.submitted" && p.scaffolded !== null) {
      const side = p.scaffolded ? scaffold.with : scaffold.without;
      side.n++;
      if (p.correct) side.ok++;
      side.ids.push(event.id);
    }
  }

  // Mesure : réussit-il nettement mieux quand l'exercice est guidé par étapes ?
  if (
    scaffold.with.n >= MIN_MEASURED_ANSWERS &&
    scaffold.without.n >= MIN_MEASURED_ANSWERS
  ) {
    const gap =
      scaffold.with.ok / scaffold.with.n -
      scaffold.without.ok / scaffold.without.n;
    const draft = open("format.scaffolded", PREFERENCES["format.scaffolded"]);
    draft.sources.add("measured");
    draft.evidence.push(...scaffold.with.ids, ...scaffold.without.ids);
    if (Math.abs(gap) >= MEASURE_THRESHOLD) {
      draft.status = gap > 0 ? "supported" : "contradicted";
      draft.confidence = Math.min(0.9, 0.5 + Math.abs(gap));
    } else {
      draft.status = "uncertain";
      draft.confidence = Math.min(draft.confidence, 0.4);
    }
  }

  return {
    hypotheses: [...drafts.values()].map((d) => ({
      key: d.key,
      statement: d.statement,
      sources: [...d.sources],
      confidence: Math.round(d.confidence * 100) / 100,
      status: d.status,
      evidence: d.evidence,
    })),
    needs: [...needs.values()],
    assessments,
  };
}
