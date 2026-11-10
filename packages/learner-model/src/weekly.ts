import type { LearnerId, LearningEvent, NotionId } from "@wema/domain";
import { projectLearnerModel } from "./project";
import { DEFAULT_SETTINGS, type LearnerModelSettings } from "./settings";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Nombre de jours résumés (aujourd'hui compris). */
export const WEEK_DAYS = 7;

export interface WeeklyActivity {
  /** Réponses par jour (UTC), du plus ancien à aujourd'hui. */
  days: { date: string; answers: number }[];
  answers: number;
  correct: number;
  /** Jours avec au moins une réponse. */
  activeDays: number;
  /** Dernier événement du journal (toutes périodes confondues). */
  lastActivityAt: Date | null;
  /** Notions passées à « maîtrisée » pendant la période. */
  validated: NotionId[];
  /** Notions travaillées pendant la période, sans être (encore) validées. */
  reworked: NotionId[];
}

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Résumé des sept derniers jours d'un élève, calculé à partir de son journal
 * seulement (aucune IA, rien d'inventé) : réponses par jour, notions validées
 * (maîtrisée maintenant, pas au début de la période) et notions reprises.
 */
export function weeklyActivity(
  learnerId: LearnerId,
  events: readonly LearningEvent[],
  now: Date,
  settings: LearnerModelSettings = DEFAULT_SETTINGS,
): WeeklyActivity {
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const start = new Date(today - (WEEK_DAYS - 1) * DAY_MS);
  const days = Array.from({ length: WEEK_DAYS }, (_, i) => ({
    date: dayKey(new Date(start.getTime() + i * DAY_MS)),
    answers: 0,
  }));
  const index = new Map(days.map((d, i) => [d.date, i]));

  let answers = 0;
  let correct = 0;
  let last: Date | null = null;
  const practiced = new Set<NotionId>();
  const before: LearningEvent[] = [];
  const upToNow: LearningEvent[] = [];
  for (const e of events) {
    if (e.occurredAt > now) continue;
    upToNow.push(e);
    if (!last || e.occurredAt > last) last = e.occurredAt;
    if (e.occurredAt < start) {
      before.push(e);
      continue;
    }
    if (e.payload.type !== "answer.submitted") continue;
    const i = index.get(dayKey(e.occurredAt));
    const day = i === undefined ? undefined : days[i];
    if (day) day.answers += 1;
    answers += 1;
    if (e.payload.correct) correct += 1;
    practiced.add(e.payload.notionId);
  }

  const project = (list: readonly LearningEvent[]) => {
    const model = projectLearnerModel(learnerId, list, settings);
    return model.ok ? model.value.notions : {};
  };
  const was = project(before);
  const is = project(upToNow);
  const validated = Object.values(is)
    .filter(
      (s) => s.status === "mastered" && was[s.notionId]?.status !== "mastered",
    )
    .map((s) => s.notionId)
    .sort();
  const done = new Set(validated);
  const reworked = [...practiced].filter((n) => !done.has(n)).sort();

  return {
    days,
    answers,
    correct,
    activeDays: days.filter((d) => d.answers > 0).length,
    lastActivityAt: last,
    validated,
    reworked,
  };
}
