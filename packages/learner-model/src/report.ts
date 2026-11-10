import type {
  LearnerId,
  LearningEvent,
  MisconceptionId,
  NotionId,
  NotionStatus,
} from "@wema/domain";
import { type LearnerModel, projectLearnerModel } from "./project";
import { DEFAULT_SETTINGS, type LearnerModelSettings } from "./settings";

/**
 * Rapport de progression d'une classe sur une période (pilote d'école ou
 * de prof particulier). Tout vient du journal : le profil de chaque élève
 * est recalculé au début et à la fin de la période, et l'activité est lue
 * sur les dates des événements. Aucune projection, aucun chiffre estimé
 * hors du journal.
 */

/** Une pause plus longue ouvre une nouvelle séance d'activité. */
export const ACTIVITY_GAP_MS = 30 * 60 * 1000;
/** Lignes gardées pour les notions et les idées fausses. */
export const REPORT_TOP = 5;

export interface ReportNotion {
  id: NotionId;
  code: string;
  name: string;
  misconceptions: readonly { id: MisconceptionId; description: string }[];
}

export interface ReportLearner {
  learnerId: LearnerId;
  events: readonly LearningEvent[];
}

export type StatusCounts = Record<NotionStatus, number>;

export interface ProgressReport {
  from: Date;
  to: Date;
  notions: number;
  learners: { enrolled: number; active: number };
  /** Couples élève × notion validés, et notions validées par au moins un élève. */
  validated: {
    start: number;
    end: number;
    notionsStart: number;
    notionsEnd: number;
  };
  /**
   * Maîtrise moyenne (0 à 1) des couples élève × notion travaillés pendant
   * la période (au moins une réponse), au début et à la fin.
   */
  mastery: {
    pairs: number;
    start: number | null;
    end: number | null;
    change: number | null;
  };
  statuses: { start: StatusCounts; end: StatusCounts };
  topNotions: {
    notionId: NotionId;
    code: string;
    name: string;
    answers: number;
    correct: number;
    learners: number;
  }[];
  misconceptions: {
    misconceptionId: MisconceptionId;
    notionName: string;
    description: string;
    /** Occurrences repérées pendant la période. */
    occurrences: number;
    /** Élèves chez qui elle est active au début, puis à la fin. */
    learnersStart: number;
    learnersEnd: number;
  }[];
  activity: {
    /** Somme des séances (première à dernière action, pause > 30 min = nouvelle séance). */
    minutes: number;
    sessions: number;
    activeDays: number;
    events: number;
  };
}

const emptyCounts = (): StatusCounts => ({
  not_seen: 0,
  needs_work: 0,
  in_progress: 0,
  mastered: 0,
});

/** Notions concernées par un événement. */
function notionsOf(event: LearningEvent): readonly NotionId[] {
  const p = event.payload;
  switch (p.type) {
    case "answer.submitted":
    case "hint.requested":
    case "teachback.assessed":
    case "oralcheck.assessed":
    case "copy.reviewed":
      return [p.notionId];
    case "session.reported":
      return p.notionIds;
    default:
      return [];
  }
}

function misconceptionsOf(event: LearningEvent): readonly MisconceptionId[] {
  const p = event.payload;
  if (p.type === "answer.submitted" || p.type === "copy.reviewed")
    return p.misconceptionId ? [p.misconceptionId] : [];
  return [];
}

const mean = (values: readonly number[]) =>
  values.length === 0
    ? null
    : values.reduce((s, v) => s + v, 0) / values.length;

export function buildProgressReport(input: {
  learners: readonly ReportLearner[];
  notions: readonly ReportNotion[];
  from: Date;
  to: Date;
  settings?: LearnerModelSettings;
}): ProgressReport {
  const settings = input.settings ?? DEFAULT_SETTINGS;
  const from = input.from.getTime();
  const to = input.to.getTime();
  const notionById = new Map(input.notions.map((n) => [n.id, n]));
  const misconceptionInfo = new Map(
    input.notions.flatMap((n) =>
      n.misconceptions.map((m) => [
        m.id,
        { notionName: n.name, description: m.description },
      ]),
    ),
  );

  const statuses = { start: emptyCounts(), end: emptyCounts() };
  const validatedStart = new Set<string>();
  const validatedEnd = new Set<string>();
  let pairsStart = 0;
  let pairsEnd = 0;
  let active = 0;
  const masteryStart: number[] = [];
  const masteryEnd: number[] = [];
  const worked = new Map<
    NotionId,
    { answers: number; correct: number; learners: Set<string> }
  >();
  const misconceptions = new Map<
    MisconceptionId,
    { occurrences: number; start: number; end: number }
  >();
  const misconceptionEntry = (id: MisconceptionId) => {
    let m = misconceptions.get(id);
    if (!m) {
      m = { occurrences: 0, start: 0, end: 0 };
      misconceptions.set(id, m);
    }
    return m;
  };
  const activity = { ms: 0, sessions: 0, events: 0 };
  const activeDays = new Set<string>();

  const project = (learnerId: LearnerId, events: readonly LearningEvent[]) => {
    const model = projectLearnerModel(learnerId, events, settings);
    // Les journaux viennent d'une lecture par élève : un mélange est un bug.
    if (!model.ok) throw new Error(`journal incohérent : ${model.error.kind}`);
    return model.value;
  };

  for (const learner of input.learners) {
    // Seuls les événements du programme de la classe comptent.
    const events = learner.events.filter((e) =>
      notionsOf(e).some((id) => notionById.has(id)),
    );
    const t = (e: LearningEvent) => e.occurredAt.getTime();
    const before = events.filter((e) => t(e) < from);
    const until = events.filter((e) => t(e) <= to);
    const during = until
      .filter((e) => t(e) >= from)
      .sort((a, b) => t(a) - t(b));
    const start: LearnerModel = project(learner.learnerId, before);
    const end: LearnerModel = project(learner.learnerId, until);

    for (const n of input.notions) {
      const s = start.notions[n.id]?.status ?? "not_seen";
      const e = end.notions[n.id]?.status ?? "not_seen";
      statuses.start[s]++;
      statuses.end[e]++;
      if (s === "mastered") {
        pairsStart++;
        validatedStart.add(n.id);
      }
      if (e === "mastered") {
        pairsEnd++;
        validatedEnd.add(n.id);
      }
      for (const [model, key] of [
        [start, "start"],
        [end, "end"],
      ] as const) {
        for (const m of model.notions[n.id]?.misconceptions ?? [])
          if (m.active && misconceptionInfo.has(m.misconceptionId))
            misconceptionEntry(m.misconceptionId)[key]++;
      }
    }

    if (during.length === 0) continue;
    active++;
    const answered = new Set<NotionId>();
    for (const e of during) {
      activeDays.add(e.occurredAt.toISOString().slice(0, 10));
      for (const m of misconceptionsOf(e))
        if (misconceptionInfo.has(m)) misconceptionEntry(m).occurrences++;
      if (e.payload.type !== "answer.submitted") continue;
      const id = e.payload.notionId;
      answered.add(id);
      const w = worked.get(id) ?? {
        answers: 0,
        correct: 0,
        learners: new Set<string>(),
      };
      w.answers++;
      if (e.payload.correct) w.correct++;
      w.learners.add(learner.learnerId);
      worked.set(id, w);
    }
    for (const id of answered) {
      masteryStart.push(start.notions[id]?.pKnown ?? settings.bkt.pInit);
      masteryEnd.push(end.notions[id]?.pKnown ?? settings.bkt.pInit);
    }
    // Séances : des actions séparées de moins de 30 minutes.
    let sessionStart = Number.NaN;
    let last = Number.NaN;
    for (const e of during) {
      if (Number.isNaN(last) || t(e) - last > ACTIVITY_GAP_MS) {
        if (!Number.isNaN(last)) activity.ms += last - sessionStart;
        activity.sessions++;
        sessionStart = t(e);
      }
      last = t(e);
    }
    activity.ms += last - sessionStart;
    activity.events += during.length;
  }

  const ms = mean(masteryStart);
  const me = mean(masteryEnd);
  return {
    from: input.from,
    to: input.to,
    notions: input.notions.length,
    learners: { enrolled: input.learners.length, active },
    validated: {
      start: pairsStart,
      end: pairsEnd,
      notionsStart: validatedStart.size,
      notionsEnd: validatedEnd.size,
    },
    mastery: {
      pairs: masteryStart.length,
      start: ms,
      end: me,
      change: ms === null || me === null ? null : me - ms,
    },
    statuses,
    topNotions: [...worked.entries()]
      .map(([id, w]) => {
        const n = notionById.get(id);
        return {
          notionId: id,
          code: n?.code ?? "",
          name: n?.name ?? "",
          answers: w.answers,
          correct: w.correct,
          learners: w.learners.size,
        };
      })
      .sort((a, b) => b.answers - a.answers || b.learners - a.learners)
      .slice(0, REPORT_TOP),
    misconceptions: [...misconceptions.entries()]
      .filter(([, m]) => m.occurrences > 0 || m.start > 0 || m.end > 0)
      .map(([id, m]) => ({
        misconceptionId: id,
        notionName: misconceptionInfo.get(id)?.notionName ?? "",
        description: misconceptionInfo.get(id)?.description ?? "",
        occurrences: m.occurrences,
        learnersStart: m.start,
        learnersEnd: m.end,
      }))
      .sort(
        (a, b) =>
          b.occurrences - a.occurrences ||
          b.learnersEnd - a.learnersEnd ||
          b.learnersStart - a.learnersStart,
      )
      .slice(0, REPORT_TOP),
    activity: {
      minutes: Math.round(activity.ms / 60000),
      sessions: activity.sessions,
      activeDays: activeDays.size,
      events: activity.events,
    },
  };
}
