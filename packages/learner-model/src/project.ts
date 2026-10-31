import type {
  EventId,
  LearnerId,
  LearningEvent,
  MisconceptionId,
  NotionId,
  NotionStatus,
  Result,
} from "@wema/domain";
import { err, ok } from "@wema/domain";
import { type BktParams, DEFAULT_BKT, updateMastery } from "./bkt";

/** Seuil à partir duquel une notion est « en cours ». */
export const IN_PROGRESS_THRESHOLD = 0.5;
/** Seuil à partir duquel une notion devient candidate à la validation. */
export const MASTERY_THRESHOLD = 0.95;
/** Délai minimal entre le passage du seuil et la bonne réponse qui confirme. */
export const RECONFIRM_DELAY_MS = 72 * 60 * 60 * 1000;
/** Bonnes réponses nécessaires pour lever une idée fausse. */
export const MISCONCEPTION_CLEARING_STREAK = 2;

export interface MisconceptionState {
  misconceptionId: MisconceptionId;
  occurrences: number;
  lastSeenAt: Date;
  active: boolean;
  evidence: readonly EventId[];
}

export interface NotionState {
  notionId: NotionId;
  pKnown: number;
  observations: number;
  status: NotionStatus;
  masteryCandidateAt: Date | null;
  evidence: readonly EventId[];
  misconceptions: readonly MisconceptionState[];
}

export interface LearnerModel {
  learnerId: LearnerId;
  eventCount: number;
  /** Seules les notions observées ; une notion absente est « non vue ». */
  notions: Readonly<Record<string, NotionState>>;
}

export type ProjectionError = {
  kind: "mixed_learners";
  expected: LearnerId;
  found: LearnerId;
  eventId: EventId;
};

interface MutableMisconception {
  misconceptionId: MisconceptionId;
  occurrences: number;
  lastSeenAt: Date;
  correctSince: number;
  evidence: EventId[];
}

interface MutableNotion {
  notionId: NotionId;
  pKnown: number;
  observations: number;
  masteryCandidateAt: Date | null;
  confirmed: boolean;
  evidence: EventId[];
  misconceptions: Map<string, MutableMisconception>;
}

/**
 * Recalcule le profil d'un élève à partir de son journal d'événements.
 * Fonction pure : mêmes événements, même profil, quel que soit leur ordre.
 */
export function projectLearnerModel(
  learnerId: LearnerId,
  events: readonly LearningEvent[],
  params: BktParams = DEFAULT_BKT,
): Result<LearnerModel, ProjectionError> {
  const foreign = events.find((e) => e.learnerId !== learnerId);
  if (foreign) {
    return err({
      kind: "mixed_learners",
      expected: learnerId,
      found: foreign.learnerId,
      eventId: foreign.id,
    });
  }

  const sorted = [...events].sort(
    (a, b) =>
      a.occurredAt.getTime() - b.occurredAt.getTime() ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );

  const notions = new Map<string, MutableNotion>();
  for (const event of sorted) {
    const { payload } = event;
    if (payload.type !== "answer.submitted") continue;

    let state = notions.get(payload.notionId);
    if (!state) {
      state = {
        notionId: payload.notionId,
        pKnown: params.pInit,
        observations: 0,
        masteryCandidateAt: null,
        confirmed: false,
        evidence: [],
        misconceptions: new Map(),
      };
      notions.set(payload.notionId, state);
    }

    state.pKnown = updateMastery(state.pKnown, payload.correct, params);
    state.observations += 1;
    state.evidence.push(event.id);

    if (state.pKnown < MASTERY_THRESHOLD) {
      state.masteryCandidateAt = null;
      state.confirmed = false;
    } else if (state.masteryCandidateAt === null) {
      state.masteryCandidateAt = event.occurredAt;
    } else if (
      payload.correct &&
      event.occurredAt.getTime() - state.masteryCandidateAt.getTime() >=
        RECONFIRM_DELAY_MS
    ) {
      state.confirmed = true;
    }

    if (payload.correct) {
      for (const m of state.misconceptions.values()) m.correctSince += 1;
    }
    if (payload.misconceptionId !== null) {
      const m = state.misconceptions.get(payload.misconceptionId) ?? {
        misconceptionId: payload.misconceptionId,
        occurrences: 0,
        lastSeenAt: event.occurredAt,
        correctSince: 0,
        evidence: [],
      };
      m.occurrences += 1;
      m.lastSeenAt = event.occurredAt;
      m.correctSince = 0;
      m.evidence.push(event.id);
      state.misconceptions.set(payload.misconceptionId, m);
    }
  }

  const result: Record<string, NotionState> = {};
  for (const s of notions.values()) {
    result[s.notionId] = {
      notionId: s.notionId,
      pKnown: s.pKnown,
      observations: s.observations,
      status: statusOf(s),
      masteryCandidateAt: s.masteryCandidateAt,
      evidence: s.evidence,
      misconceptions: [...s.misconceptions.values()].map((m) => ({
        misconceptionId: m.misconceptionId,
        occurrences: m.occurrences,
        lastSeenAt: m.lastSeenAt,
        active: m.correctSince < MISCONCEPTION_CLEARING_STREAK,
        evidence: m.evidence,
      })),
    };
  }
  return ok({ learnerId, eventCount: events.length, notions: result });
}

function statusOf(s: MutableNotion): NotionStatus {
  if (s.confirmed && s.pKnown >= MASTERY_THRESHOLD) return "mastered";
  if (s.pKnown >= IN_PROGRESS_THRESHOLD) return "in_progress";
  return "needs_work";
}

export function notionStatus(model: LearnerModel, id: NotionId): NotionStatus {
  return model.notions[id]?.status ?? "not_seen";
}
