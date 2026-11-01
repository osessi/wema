import type {
  EventId,
  Hypothesis,
  HypothesisSource,
  LearningEvent,
  NotionId,
  PreferenceKey,
} from "@wema/domain";
import { containsHealthTerm, PREFERENCES } from "@wema/domain";

/** Confiance de départ selon la source. */
export const SOURCE_CONFIDENCE: Record<
  Exclude<HypothesisSource, "measured">,
  number
> = {
  declared_guardian: 0.5,
  declared_teacher: 0.5,
  declared_learner: 0.4,
  intake: 0.35,
};

/** Préférences qui s'excluent : seule la plus récente reste affirmée. */
const EXCLUSIVE: readonly (readonly string[])[] = [
  ["confidence.low", "confidence.high"],
];

export interface TutorAssessmentSummary {
  notionId: NotionId;
  kind: "teach_back" | "oral_check";
  understanding: number;
  confidence: number;
  summary: string;
  sessionId: string;
  evidence: EventId;
}

export interface LearnerProfileProjection {
  hypotheses: Hypothesis[];
  assessments: TutorAssessmentSummary[];
}

/** Dernier avis d'une source sur une hypothèse. */
interface Opinion {
  value: boolean;
  confidence: number;
  at: number;
}

interface Draft {
  key: string;
  statement: string;
  opinions: Map<HypothesisSource, Opinion>;
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
 * (fonction pure). Chaque source garde son dernier avis ; des sources
 * d'accord se renforcent, des sources en désaccord rendent l'hypothèse
 * incertaine. L'entretien pèse moins qu'une déclaration.
 *
 * La mesure automatique « réussit mieux avec des étapes guidées » est
 * désactivée : les étapes sont données aux élèves en difficulté, si bien que
 * la comparaison serait biaisée (relecture du lot 6). Elle reviendra avec une
 * présentation tirée au hasard, à état comparable.
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
  const assessments: TutorAssessmentSummary[] = [];

  const draftOf = (key: string, statement: string): Draft => {
    const existing = drafts.get(key);
    if (existing) return existing;
    const draft: Draft = { key, statement, opinions: new Map(), evidence: [] };
    drafts.set(key, draft);
    return draft;
  };

  for (const event of sorted) {
    const p = event.payload;
    const at = event.occurredAt.getTime();
    if (p.type === "preference.declared") {
      // Un libellé qui évoque la santé n'entre jamais dans le profil.
      if (p.label && containsHealthTerm(p.label)) continue;
      const source: HypothesisSource = `declared_${p.source}`;
      const draft = draftOf(keyOf(p.key, p.label), statementOf(p.key, p.label));
      draft.opinions.set(source, {
        value: p.value,
        confidence: SOURCE_CONFIDENCE[source],
        at,
      });
      draft.evidence.push(event.id);
    } else if (p.type === "intake.completed") {
      for (const h of p.hypotheses) {
        if (h.label && containsHealthTerm(h.label)) continue;
        const draft = draftOf(
          keyOf(h.key, h.label),
          statementOf(h.key, h.label),
        );
        // Une impression d'entretien ne vaut pas une déclaration : confiance plafonnée.
        draft.opinions.set("intake", {
          value: true,
          confidence: Math.min(h.confidence, SOURCE_CONFIDENCE.intake),
          at,
        });
        draft.evidence.push(event.id);
      }
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
        sessionId: p.sessionId,
        evidence: event.id,
      });
    }
  }

  const hypotheses: Hypothesis[] = [...drafts.values()].map((d) => {
    const opinions = [...d.opinions.values()];
    const affirm = opinions.filter((o) => o.value);
    const deny = opinions.filter((o) => !o.value);
    let status: Hypothesis["status"];
    let confidence: number;
    if (affirm.length > 0 && deny.length > 0) {
      // Désaccord entre sources : on ne tranche pas.
      status = "uncertain";
      confidence = Math.min(...opinions.map((o) => o.confidence)) / 2;
    } else {
      const side = affirm.length > 0 ? affirm : deny;
      status = affirm.length > 0 ? "supported" : "contradicted";
      // Plusieurs sources d'accord se renforcent, sans dépasser 0,8 sans mesure.
      const best = Math.max(...side.map((o) => o.confidence));
      confidence = Math.min(0.8, best + 0.15 * (side.length - 1));
    }
    return {
      key: d.key,
      statement: d.statement,
      sources: [...d.opinions.keys()],
      confidence: Math.round(confidence * 100) / 100,
      status,
      evidence: d.evidence,
    };
  });

  // Deux préférences qui s'excluent : seule la plus récemment affirmée reste.
  for (const group of EXCLUSIVE) {
    const supported = hypotheses.filter(
      (h) => group.includes(h.key) && h.status === "supported",
    );
    if (supported.length < 2) continue;
    const latest = (h: Hypothesis) =>
      Math.max(
        ...[...(drafts.get(h.key)?.opinions.values() ?? [])].map((o) => o.at),
      );
    const keep = supported.reduce((a, b) => (latest(a) >= latest(b) ? a : b));
    for (const h of supported) if (h !== keep) h.status = "uncertain";
  }

  return { hypotheses, assessments };
}
