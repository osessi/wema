import type { EventId, LearningEvent, NotionId } from "@wema/domain";
import type { LearnerModel } from "@wema/learner-model";

/** Intervalles des re-tests espacés, en jours ; le suivant après chaque rappel réussi. */
export const REVIEW_INTERVALS_DAYS = [3, 7, 21, 60] as const;
/** Échecs d'affilée sur une notion avant de proposer une victoire facile. */
export const FAILURE_STREAK = 3;
/** Réponses sur une notion avant de la considérer comme bloquante. */
export const BLOCKED_AFTER = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

export type NextAction =
  | {
      kind: "finish_exercise";
      variantId: string;
      notionId: NotionId;
      reason: string;
      evidence: readonly EventId[];
    }
  | {
      kind: "easy_win";
      notionId: NotionId;
      reason: string;
      evidence: readonly EventId[];
    }
  | {
      kind: "prerequisite_first";
      notionId: NotionId;
      blockedNotionId: NotionId;
      reason: string;
      evidence: readonly EventId[];
    }
  | {
      kind: "misconception_focus";
      notionId: NotionId;
      misconceptionId: string;
      reason: string;
      evidence: readonly EventId[];
    }
  | {
      kind: "practice";
      notionId: NotionId;
      reason: string;
      evidence: readonly EventId[];
    }
  | {
      kind: "spaced_review";
      notionId: NotionId;
      dueSince: Date;
      reason: string;
      evidence: readonly EventId[];
    }
  | { kind: "intake"; reason: string; evidence: readonly EventId[] };

export interface OrchestratorInput {
  model: LearnerModel;
  events: readonly LearningEvent[];
  /** Prérequis de chaque notion connue (graphe du référentiel). */
  prerequisites: ReadonlyMap<string, readonly NotionId[]>;
  /** Variantes encore ouvertes de l'élève (ni réussies, ni à court d'essais). */
  openVariants: readonly { id: string; notionId: NotionId }[];
  now: Date;
}

/** Réponses d'une notion, dans l'ordre chronologique. */
function answersOf(events: readonly LearningEvent[], notionId: string) {
  return events
    .filter(
      (e) =>
        e.payload.type === "answer.submitted" &&
        e.payload.notionId === notionId,
    )
    .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
}

/**
 * Date du prochain re-test d'une notion validée : l'intervalle s'allonge à
 * chaque bonne réponse donnée après la validation, et repart au début après
 * une erreur.
 */
export function nextReviewAt(
  events: readonly LearningEvent[],
  notionId: string,
  masteredAt: Date,
): Date {
  let step = 0;
  let last = masteredAt;
  for (const e of answersOf(events, notionId)) {
    if (
      e.occurredAt.getTime() <= masteredAt.getTime() ||
      e.payload.type !== "answer.submitted"
    )
      continue;
    // Un rappel ne compte que s'il arrive après l'échéance précédente.
    const due =
      last.getTime() +
      (REVIEW_INTERVALS_DAYS[
        Math.min(step, REVIEW_INTERVALS_DAYS.length - 1)
      ] ?? 60) *
        DAY_MS;
    if (!e.payload.correct) {
      step = 0;
      last = e.occurredAt;
    } else if (e.occurredAt.getTime() >= due) {
      step++;
      last = e.occurredAt;
    }
  }
  const interval =
    REVIEW_INTERVALS_DAYS[Math.min(step, REVIEW_INTERVALS_DAYS.length - 1)] ??
    60;
  return new Date(last.getTime() + interval * DAY_MS);
}

/**
 * Prochaines actions utiles pour un élève, de la plus urgente à la moins
 * urgente, chacune avec sa raison et ses preuves (fonction pure).
 */
export function nextActions(input: OrchestratorInput): NextAction[] {
  const { model, events, now } = input;
  const actions: NextAction[] = [];
  const states = Object.values(model.notions);

  for (const v of input.openVariants) {
    actions.push({
      kind: "finish_exercise",
      variantId: v.id,
      notionId: v.notionId,
      reason: "Un exercice commencé attend une réponse.",
      evidence: [],
    });
  }

  for (const state of states) {
    const answers = answersOf(events, state.notionId);
    const tail = answers.slice(-FAILURE_STREAK);
    if (
      tail.length === FAILURE_STREAK &&
      tail.every(
        (e) => e.payload.type === "answer.submitted" && !e.payload.correct,
      )
    ) {
      actions.push({
        kind: "easy_win",
        notionId: state.notionId,
        reason: `${FAILURE_STREAK} erreurs d'affilée : une réussite facile pour reprendre confiance.`,
        evidence: tail.map((e) => e.id),
      });
      continue;
    }
    if (state.status === "needs_work" && state.observations >= BLOCKED_AFTER) {
      const missing = (input.prerequisites.get(state.notionId) ?? []).find(
        (p) => model.notions[p]?.status !== "mastered",
      );
      if (missing) {
        actions.push({
          kind: "prerequisite_first",
          notionId: missing,
          blockedNotionId: state.notionId,
          reason:
            "La notion bloque : on consolide d'abord un prérequis non validé.",
          evidence: state.evidence.slice(-BLOCKED_AFTER),
        });
        continue;
      }
    }
    const misconception = state.misconceptions.find((m) => m.active);
    if (misconception) {
      actions.push({
        kind: "misconception_focus",
        notionId: state.notionId,
        misconceptionId: misconception.misconceptionId,
        reason:
          "Une erreur de raisonnement revient : une séance ciblée pour la dépasser.",
        evidence: misconception.evidence,
      });
      continue;
    }
    if (state.status === "needs_work" || state.status === "in_progress") {
      actions.push({
        kind: "practice",
        notionId: state.notionId,
        reason: "Notion en cours d'apprentissage.",
        evidence: state.evidence.slice(-3),
      });
      continue;
    }
    if (state.status === "mastered" && state.masteryCandidateAt) {
      const due = nextReviewAt(
        events,
        state.notionId,
        state.masteryCandidateAt,
      );
      if (due.getTime() <= now.getTime()) {
        actions.push({
          kind: "spaced_review",
          notionId: state.notionId,
          dueSince: due,
          reason: "Notion validée à revoir pour qu'elle reste acquise.",
          evidence: state.evidence.slice(-1),
        });
      }
    }
  }

  if (!events.some((e) => e.payload.type === "intake.completed")) {
    actions.push({
      kind: "intake",
      reason: "L'entretien initial n'a pas encore eu lieu.",
      evidence: [],
    });
  }

  const rank: Record<NextAction["kind"], number> = {
    finish_exercise: 0,
    easy_win: 1,
    prerequisite_first: 2,
    misconception_focus: 3,
    spaced_review: 4,
    practice: 5,
    intake: 6,
  };
  return actions.sort((a, b) => rank[a.kind] - rank[b.kind]);
}

/** Jours d'inactivité avant une relance. */
export const NUDGE_AFTER_DAYS = 2;

/** Relance utile ? Seulement après une période sans activité, et s'il y a quelque chose à faire. */
export function nudgeReason(input: {
  actions: readonly NextAction[];
  lastActivityAt: Date | null;
  now: Date;
}): NextAction | null {
  const first = input.actions[0];
  if (!first || !input.lastActivityAt) return null;
  const idle = input.now.getTime() - input.lastActivityAt.getTime();
  return idle >= NUDGE_AFTER_DAYS * DAY_MS ? first : null;
}
