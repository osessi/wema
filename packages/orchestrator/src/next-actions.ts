import type { EventId, LearningEvent, NotionId } from "@wema/domain";
import type { LearnerModel } from "@wema/learner-model";

/** Intervalles des re-tests espacés, en jours ; le suivant après chaque rappel réussi. */
export const REVIEW_INTERVALS_DAYS = [3, 7, 21, 60] as const;
/** Échecs d'affilée sur une notion avant de proposer une victoire facile. */
export const FAILURE_STREAK = 3;
/** Réponses sur une notion avant de la considérer comme bloquante. */
export const BLOCKED_AFTER = 3;

const DAY_MS = 24 * 60 * 60 * 1000;
/** Jours avant l'échéance à partir desquels un devoir passe en tête. */
export const DUE_SOON_DAYS = 3;

export type NextAction =
  | {
      kind: "assignment_due";
      variantId: string;
      notionId: NotionId;
      dueAt: Date;
      reason: string;
      evidence: readonly EventId[];
    }
  | {
      kind: "start_notion";
      notionId: NotionId;
      reason: string;
      evidence: readonly EventId[];
    }
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
  /**
   * Variantes encore ouvertes de l'élève (ni réussies, ni à court d'essais) ;
   * `started` : l'élève a déjà essayé de répondre.
   */
  openVariants: readonly {
    id: string;
    notionId: NotionId;
    started?: boolean;
  }[];
  /**
   * Notions non archivées du référentiel. Quand l'ensemble est fourni, une
   * notion archivée n'est jamais proposée (ni comme prérequis).
   */
  activeNotions?: ReadonlySet<string>;
  /** Idées fausses non archivées ; une idée fausse archivée n'est jamais ciblée. */
  activeMisconceptions?: ReadonlySet<string>;
  /** Devoirs non rendus de l'élève, avec leur échéance. */
  assignments?: readonly {
    variantId: string;
    notionId: NotionId;
    dueAt: Date;
  }[];
  /** Notions du programme de ses classes, dans l'ordre du programme. */
  programNotions?: readonly NotionId[];
  now: Date;
}

/**
 * Réponses d'une notion, dans l'ordre du journal : date, puis identifiant à
 * date égale (comme le calcul du profil), pour que l'ordre de fourniture des
 * événements ne change jamais les actions proposées.
 */
function answersOf(events: readonly LearningEvent[], notionId: string) {
  return events
    .filter(
      (e) =>
        e.payload.type === "answer.submitted" &&
        e.payload.notionId === notionId,
    )
    .sort(
      (a, b) =>
        a.occurredAt.getTime() - b.occurredAt.getTime() ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
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
  const isActive = (id: string) =>
    !input.activeNotions || input.activeNotions.has(id);
  const states = Object.values(model.notions).filter((s) =>
    isActive(s.notionId),
  );

  // Un devoir dont l'échéance approche (ou est passée) passe avant tout.
  const due = new Set<string>();
  for (const a of input.assignments ?? []) {
    if (!isActive(a.notionId)) continue;
    if (a.dueAt.getTime() - now.getTime() <= DUE_SOON_DAYS * DAY_MS) {
      due.add(a.variantId);
      actions.push({
        kind: "assignment_due",
        variantId: a.variantId,
        notionId: a.notionId,
        dueAt: a.dueAt,
        reason:
          a.dueAt.getTime() < now.getTime()
            ? "Un devoir est en retard."
            : "Un devoir arrive bientôt à échéance.",
        evidence: [],
      });
    }
  }

  // Une seule action par notion : de préférence un exercice déjà commencé.
  const openByNotion = new Map<
    string,
    { id: string; notionId: NotionId; started?: boolean }
  >();
  for (const v of input.openVariants) {
    if (due.has(v.id) || !isActive(v.notionId)) continue;
    const current = openByNotion.get(v.notionId);
    if (!current || (!current.started && v.started))
      openByNotion.set(v.notionId, v);
  }
  for (const v of openByNotion.values()) {
    actions.push({
      kind: "finish_exercise",
      variantId: v.id,
      notionId: v.notionId,
      reason: v.started
        ? "Un exercice commencé attend une réponse."
        : "Un exercice vous attend, pas encore commencé.",
      evidence: [],
    });
  }

  /** Premier prérequis non validé (et non archivé) d'une notion. */
  const missingPrerequisite = (id: string) =>
    (input.prerequisites.get(id) ?? []).find(
      (p) => isActive(p) && model.notions[p]?.status !== "mastered",
    );

  for (const state of states) {
    const answers = answersOf(events, state.notionId);
    const tail = answers.slice(-FAILURE_STREAK);
    if (
      tail.length === FAILURE_STREAK &&
      tail.every(
        (e) => e.payload.type === "answer.submitted" && !e.payload.correct,
      )
    ) {
      // La vraie cause est peut-être un prérequis : la réussite facile se fait dessus.
      const missing = missingPrerequisite(state.notionId);
      actions.push({
        kind: "easy_win",
        notionId: missing ?? state.notionId,
        reason: missing
          ? `${FAILURE_STREAK} erreurs d'affilée : une réussite facile sur une base à consolider.`
          : `${FAILURE_STREAK} erreurs d'affilée : une réussite facile pour reprendre confiance.`,
        evidence: tail.map((e) => e.id),
      });
      continue;
    }
    if (state.status === "needs_work" && state.observations >= BLOCKED_AFTER) {
      const missing = missingPrerequisite(state.notionId);
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
    const misconception = state.misconceptions.find(
      (m) =>
        m.active &&
        (!input.activeMisconceptions ||
          input.activeMisconceptions.has(m.misconceptionId)),
    );
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

  // Prochaine notion nouvelle du programme : jamais travaillée (aucune réponse ;
  // une copie relue seule ne compte pas), prérequis validés.
  const next = (input.programNotions ?? []).find(
    (id) =>
      isActive(id) &&
      (model.notions[id]?.observations ?? 0) === 0 &&
      (input.prerequisites.get(id) ?? []).every(
        (p) => !isActive(p) || model.notions[p]?.status === "mastered",
      ),
  );
  if (next) {
    actions.push({
      kind: "start_notion",
      notionId: next,
      reason: "Prochaine notion du programme, prérequis validés.",
      evidence: [],
    });
  }

  if (!events.some((e) => e.payload.type === "intake.completed")) {
    actions.push({
      kind: "intake",
      reason: "L'entretien initial n'a pas encore eu lieu.",
      evidence: [],
    });
  }

  const rank: Record<NextAction["kind"], number> = {
    assignment_due: 0,
    finish_exercise: 1,
    easy_win: 2,
    prerequisite_first: 3,
    misconception_focus: 4,
    spaced_review: 5,
    practice: 6,
    start_notion: 7,
    intake: 8,
  };
  // Une seule action par notion : la mieux classée.
  const seen = new Set<string>();
  return actions
    .sort((a, b) => rank[a.kind] - rank[b.kind])
    .filter((a) => {
      if (!("notionId" in a)) return true;
      if (seen.has(a.notionId)) return false;
      seen.add(a.notionId);
      return true;
    });
}

/** Jours d'inactivité avant une relance. */
export const NUDGE_AFTER_DAYS = 2;
/**
 * Délai avant chaque relance successive sans activité : 2 jours après la
 * dernière activité, puis 4, 7 et 14 jours après la relance précédente.
 */
export const NUDGE_SPACING_DAYS = [2, 4, 7, 14] as const;
/** Relances au plus sans aucune activité de l'élève ; ensuite on se tait. */
export const MAX_NUDGES_WITHOUT_ACTIVITY = NUDGE_SPACING_DAYS.length;

/**
 * Relance utile ? Seulement après une période sans activité, s'il y a
 * quelque chose à faire, si la relance précédente a été lue, avec un
 * espacement qui s'allonge, et au plus quelques relances sans réponse.
 */
export function nudgeReason(input: {
  actions: readonly NextAction[];
  lastActivityAt: Date | null;
  /** Relances déjà préparées, de la plus récente à la plus ancienne. */
  previousNudges?: readonly { createdAt: Date; read: boolean }[];
  now: Date;
}): NextAction | null {
  const first = input.actions[0];
  if (!first || !input.lastActivityAt) return null;
  const since = input.lastActivityAt.getTime();
  const pending = (input.previousNudges ?? []).filter(
    (n) => n.createdAt.getTime() > since,
  );
  // Une relance non lue suffit : on n'en empile pas d'autres.
  if (pending.some((n) => !n.read)) return null;
  if (pending.length >= MAX_NUDGES_WITHOUT_ACTIVITY) return null;
  const last = pending.reduce(
    (max, n) => Math.max(max, n.createdAt.getTime()),
    since,
  );
  const wait =
    NUDGE_SPACING_DAYS[
      Math.min(pending.length, NUDGE_SPACING_DAYS.length - 1)
    ] ?? NUDGE_AFTER_DAYS;
  return input.now.getTime() - last >= wait * DAY_MS ? first : null;
}
