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
import { updateMastery } from "./bkt";
import { DEFAULT_SETTINGS, type LearnerModelSettings } from "./settings";

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
  settings: LearnerModelSettings = DEFAULT_SETTINGS,
): Result<LearnerModel, ProjectionError> {
  const { bkt, masteryThreshold, misconceptionClearingStreak } = settings;
  const reconfirmDelayMs = settings.reconfirmDelayHours * 60 * 60 * 1000;
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
        pKnown: bkt.pInit,
        observations: 0,
        masteryCandidateAt: null,
        confirmed: false,
        evidence: [],
        misconceptions: new Map(),
      };
      notions.set(payload.notionId, state);
    }

    state.pKnown = updateMastery(state.pKnown, payload.correct, bkt);
    state.observations += 1;
    state.evidence.push(event.id);

    if (state.pKnown < masteryThreshold) {
      state.masteryCandidateAt = null;
      state.confirmed = false;
    } else if (state.masteryCandidateAt === null) {
      state.masteryCandidateAt = event.occurredAt;
    } else if (
      payload.correct &&
      event.occurredAt.getTime() - state.masteryCandidateAt.getTime() >=
        reconfirmDelayMs
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
      status: statusOf(s, settings),
      masteryCandidateAt: s.masteryCandidateAt,
      evidence: s.evidence,
      misconceptions: [...s.misconceptions.values()].map((m) => ({
        misconceptionId: m.misconceptionId,
        occurrences: m.occurrences,
        lastSeenAt: m.lastSeenAt,
        active: m.correctSince < misconceptionClearingStreak,
        evidence: m.evidence,
      })),
    };
  }
  return ok({ learnerId, eventCount: events.length, notions: result });
}

function statusOf(
  s: MutableNotion,
  { masteryThreshold, inProgressThreshold }: LearnerModelSettings,
): NotionStatus {
  if (s.confirmed && s.pKnown >= masteryThreshold) return "mastered";
  if (s.pKnown >= inProgressThreshold) return "in_progress";
  return "needs_work";
}

export function notionStatus(model: LearnerModel, id: NotionId): NotionStatus {
  return model.notions[id]?.status ?? "not_seen";
}
