import {
  asEventId,
  asLearnerId,
  asMisconceptionId,
  asNotionId,
  type LearnerId,
  type LearningEvent,
  type NotionId,
} from "@wema/domain";
import { describe, expect, it } from "vitest";
import { buildProgressReport, type ReportNotion } from "./report";
import { DEFAULT_SETTINGS } from "./settings";

const ana = asLearnerId("1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d");
const bo = asLearnerId("9f8e7d6c-5b4a-4c3d-8e2f-1a0b9c8d7e6f");
const cy = asLearnerId("2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e");
const n1 = asNotionId("n1");
const n2 = asNotionId("n2");
const outside = asNotionId("hors-programme");
const mis = asMisconceptionId("m1");

const notions: ReportNotion[] = [
  {
    id: n1,
    code: "n-un",
    name: "Notion un",
    misconceptions: [{ id: mis, description: "Idée fausse un" }],
  },
  { id: n2, code: "n-deux", name: "Notion deux", misconceptions: [] },
];

let counter = 0;
function answer(
  learnerId: LearnerId,
  at: string,
  correct: boolean,
  notionId: NotionId = n1,
  misconception: boolean = false,
): LearningEvent {
  counter += 1;
  return {
    id: asEventId(
      `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`,
    ),
    learnerId,
    occurredAt: new Date(at),
    source: "app",
    payload: {
      type: "answer.submitted",
      notionId,
      correct,
      hintsUsed: 0,
      misconceptionId: misconception ? mis : null,
      exerciseRef: null,
      response: null,
      scaffolded: null,
      misconceptionSource: null,
      misconceptionConfidence: null,
      format: null,
    },
  };
}

/** Bonnes réponses en rafale, puis une confirmation 4 jours après : notion validée. */
function mastering(learnerId: LearnerId, day: string, notionId = n1) {
  const burst = Array.from({ length: 6 }, (_, i) =>
    answer(learnerId, `${day}T10:0${i}:00Z`, true, notionId),
  );
  const d = new Date(`${day}T10:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 4);
  return [...burst, answer(learnerId, d.toISOString(), true, notionId)];
}

const from = new Date("2026-03-01T00:00:00Z");
const to = new Date("2026-05-31T23:59:59Z");

describe("buildProgressReport", () => {
  it("sans élève ni événement : tout est à zéro, rien n'est inventé", () => {
    const r = buildProgressReport({ learners: [], notions, from, to });
    expect(r.learners).toEqual({ enrolled: 0, active: 0 });
    expect(r.mastery).toEqual({
      pairs: 0,
      start: null,
      end: null,
      change: null,
    });
    expect(r.topNotions).toEqual([]);
    expect(r.misconceptions).toEqual([]);
    expect(r.activity).toEqual({
      minutes: 0,
      sessions: 0,
      activeDays: 0,
      events: 0,
    });
  });

  it("compte les notions validées au début et à la fin, et les statuts", () => {
    const r = buildProgressReport({
      learners: [
        // Validée avant la période.
        { learnerId: ana, events: mastering(ana, "2026-01-10") },
        // Validée pendant la période.
        { learnerId: bo, events: mastering(bo, "2026-04-01") },
        // Inscrit, jamais actif.
        { learnerId: cy, events: [] },
      ],
      notions,
      from,
      to,
    });
    expect(r.learners).toEqual({ enrolled: 3, active: 1 });
    expect(r.validated).toEqual({
      start: 1,
      end: 2,
      notionsStart: 1,
      notionsEnd: 1,
    });
    expect(r.statuses.start).toEqual({
      not_seen: 5,
      needs_work: 0,
      in_progress: 0,
      mastered: 1,
    });
    expect(r.statuses.end.mastered).toBe(2);
    expect(r.statuses.end.not_seen).toBe(4);
  });

  it("maîtrise moyenne des couples travaillés pendant la période", () => {
    const r = buildProgressReport({
      learners: [{ learnerId: bo, events: mastering(bo, "2026-04-01") }],
      notions,
      from,
      to,
    });
    expect(r.mastery.pairs).toBe(1);
    expect(r.mastery.start).toBe(DEFAULT_SETTINGS.bkt.pInit);
    expect(r.mastery.end).toBeGreaterThan(0.95);
    expect(r.mastery.change).toBeCloseTo(
      (r.mastery.end ?? 0) - DEFAULT_SETTINGS.bkt.pInit,
    );
  });

  it("ignore les événements hors programme et hors période", () => {
    const r = buildProgressReport({
      learners: [
        {
          learnerId: ana,
          events: [
            answer(ana, "2026-04-02T10:00:00Z", true, outside),
            answer(ana, "2026-06-15T10:00:00Z", true),
          ],
        },
      ],
      notions,
      from,
      to,
    });
    expect(r.learners.active).toBe(0);
    expect(r.topNotions).toEqual([]);
    expect(r.statuses.end.not_seen).toBe(2);
  });

  it("notions les plus travaillées, triées par réponses", () => {
    const r = buildProgressReport({
      learners: [
        {
          learnerId: ana,
          events: [
            answer(ana, "2026-04-02T10:00:00Z", true, n2),
            answer(ana, "2026-04-02T10:05:00Z", false, n1),
            answer(ana, "2026-04-02T10:06:00Z", true, n1),
          ],
        },
        {
          learnerId: bo,
          events: [answer(bo, "2026-04-03T10:00:00Z", true, n1)],
        },
      ],
      notions,
      from,
      to,
    });
    expect(
      r.topNotions.map((n) => [n.code, n.answers, n.correct, n.learners]),
    ).toEqual([
      ["n-un", 3, 2, 2],
      ["n-deux", 1, 1, 1],
    ]);
  });

  it("idées fausses : occurrences de la période et évolution du nombre d'élèves", () => {
    const r = buildProgressReport({
      learners: [
        {
          learnerId: ana,
          events: [
            // Active avant la période (vue deux fois)…
            answer(ana, "2026-02-01T10:00:00Z", false, n1, true),
            answer(ana, "2026-02-01T10:01:00Z", false, n1, true),
            // … levée pendant la période par deux bonnes réponses.
            answer(ana, "2026-04-01T10:00:00Z", true),
            answer(ana, "2026-04-01T10:01:00Z", true),
          ],
        },
        {
          learnerId: bo,
          events: [
            answer(bo, "2026-04-01T10:00:00Z", false, n1, true),
            answer(bo, "2026-04-01T10:02:00Z", false, n1, true),
          ],
        },
      ],
      notions,
      from,
      to,
    });
    expect(r.misconceptions).toEqual([
      {
        misconceptionId: mis,
        notionName: "Notion un",
        description: "Idée fausse un",
        occurrences: 2,
        learnersStart: 1,
        learnersEnd: 1,
      },
    ]);
  });

  it("temps d'activité : séances découpées par les pauses de plus de 30 minutes", () => {
    const r = buildProgressReport({
      learners: [
        {
          learnerId: ana,
          events: [
            answer(ana, "2026-04-01T10:00:00Z", true),
            answer(ana, "2026-04-01T10:20:00Z", true),
            // Pause de 40 minutes : nouvelle séance.
            answer(ana, "2026-04-01T11:00:00Z", true),
            answer(ana, "2026-04-01T11:10:00Z", true),
            answer(ana, "2026-04-03T09:00:00Z", true),
          ],
        },
      ],
      notions,
      from,
      to,
    });
    expect(r.activity).toEqual({
      minutes: 30,
      sessions: 3,
      activeDays: 2,
      events: 5,
    });
  });
});
