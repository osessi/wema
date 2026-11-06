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

/** Confiance de l'IA à partir de laquelle une seule occurrence suffit. */
export const AI_CERTAIN_CONFIDENCE = 0.85;

interface MutableMisconception {
  misconceptionId: MisconceptionId;
  occurrences: number;
  lastSeenAt: Date;
  correctSince: number;
  /** Vrai si au moins une occurrence est sûre (règle, ou IA très confiante). */
  certain: boolean;
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
  const stateOf = (notionId: NotionId): MutableNotion => {
    let state = notions.get(notionId);
    if (!state) {
      state = {
        notionId,
        pKnown: bkt.pInit,
        observations: 0,
        masteryCandidateAt: null,
        confirmed: false,
        evidence: [],
        misconceptions: new Map(),
      };
      notions.set(notionId, state);
    }
    return state;
  };
  /** Une occurrence d'idée fausse ; sûre si elle vient d'une règle ou d'une IA très confiante. */
  const observeMisconception = (
    state: MutableNotion,
    misconceptionId: MisconceptionId,
    certain: boolean,
    event: LearningEvent,
  ) => {
    const m = state.misconceptions.get(misconceptionId) ?? {
      misconceptionId,
      occurrences: 0,
      lastSeenAt: event.occurredAt,
      correctSince: 0,
      certain: false,
      evidence: [],
    };
    m.occurrences += 1;
    if (certain) m.certain = true;
    m.lastSeenAt = event.occurredAt;
    m.correctSince = 0;
    m.evidence.push(event.id);
    state.misconceptions.set(misconceptionId, m);
  };

  for (const event of sorted) {
    const { payload } = event;
    // Copie photographiée : une idée fausse observée sur le raisonnement, jamais
    // une preuve de maîtrise (seule une réponse vérifiée par services/math en est une).
    if (payload.type === "copy.reviewed") {
      if (payload.misconceptionId !== null) {
        observeMisconception(
          stateOf(payload.notionId),
          payload.misconceptionId,
          (payload.misconceptionConfidence ?? 0) >= AI_CERTAIN_CONFIDENCE,
          event,
        );
      }
      continue;
    }
    if (payload.type !== "answer.submitted") continue;

    const state = stateOf(payload.notionId);

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
      // Repérée par une règle, ou par l'IA avec une confiance élevée : c'est établi.
      // Sinon, il faut la voir deux fois avant de la tenir pour active.
      observeMisconception(
        state,
        payload.misconceptionId,
        payload.misconceptionSource !== "ai" ||
          (payload.misconceptionConfidence ?? 0) >= AI_CERTAIN_CONFIDENCE,
        event,
      );
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
        active:
          (m.certain || m.occurrences >= 2) &&
          m.correctSince < misconceptionClearingStreak,
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
  // Seulement des copies relues, aucune réponse : la notion reste « non vue » pour la maîtrise.
  if (s.observations === 0) return "not_seen";
  if (s.confirmed && s.pKnown >= masteryThreshold) return "mastered";
  if (s.pKnown >= inProgressThreshold) return "in_progress";
  return "needs_work";
}

export function notionStatus(model: LearnerModel, id: NotionId): NotionStatus {
  return model.notions[id]?.status ?? "not_seen";
}
