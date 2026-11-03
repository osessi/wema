import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import {
  buildCollectiveInsights,
  COLLECTIVE_MIN_LEARNERS,
  createCollectiveStore,
  createCurriculumStore,
  fromPglite,
  migrate,
  type RawCollectiveData,
  type SqlExecutor,
  scaffoldingGain,
} from "./index";

function must<T, E>(r: { ok: true; value: T } | { ok: false; error: E }): T {
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.value;
}

const empty: RawCollectiveData = {
  notions: [],
  misconceptions: [],
  formats: [],
  exercises: [],
  tutor: [],
};
const notion = (notionId: string, learners: number) => ({
  notionId,
  learners,
  answers: learners * 2,
  correct: learners,
  stuck: 1,
  succeededLearners: learners,
  avgAnswersBeforeSuccess: 1,
});
const group = (learners: number, nextCorrect: number) => ({
  notionId: "a",
  learners,
  answers: 20,
  correct: 10,
  followed: 20,
  nextCorrect,
});

describe("agrégats collectifs : seuil d'anonymat", () => {
  it("ne publie jamais un groupe de moins de 10 élèves", () => {
    const insights = buildCollectiveInsights({
      ...empty,
      notions: [notion("a", 10), notion("b", 9)],
      misconceptions: [
        {
          notionId: "a",
          misconceptionId: "m1",
          description: "M1",
          learners: 10,
        },
        {
          notionId: "a",
          misconceptionId: "m2",
          description: "M2",
          learners: 9,
        },
      ],
      formats: [
        { ...group(10, 15), format: "text", scaffolded: true },
        { ...group(9, 5), format: "comics", scaffolded: false },
      ],
      exercises: [{ ...group(4, 20), intentId: "i1", objective: "O" }],
      tutor: [{ notionId: "a", learners: 9, avgSeconds: 300 }],
    });
    expect(insights.map((i) => i.notionId)).toEqual(["a"]);
    const a = insights[0];
    expect(a?.misconceptions.map((m) => m.misconceptionId)).toEqual(["m1"]);
    expect(a?.misconceptions[0]?.share).toBe(1);
    expect(a?.formats.map((f) => f.format)).toEqual(["text"]);
    expect(a?.exercises).toEqual([]);
    expect(a?.avgTutorSeconds).toBeNull();
    expect(a?.avgAnswersToSuccess).toBe(2);
  });

  it("un seuil demandé plus bas est ramené au minimum", () => {
    const insights = buildCollectiveInsights(
      { ...empty, notions: [notion("a", 5)] },
      2,
    );
    expect(COLLECTIVE_MIN_LEARNERS).toBe(10);
    expect(insights).toEqual([]);
    expect(
      buildCollectiveInsights({ ...empty, notions: [notion("a", 12)] }, 15),
    ).toEqual([]);
  });

  it("classe les formats par progression et mesure l'avantage des étapes guidées", () => {
    const [a] = buildCollectiveInsights({
      ...empty,
      notions: [notion("a", 30)],
      formats: [
        { ...group(12, 8), format: "text", scaffolded: false },
        { ...group(12, 16), format: "text", scaffolded: true },
      ],
    });
    expect(a?.formats.map((f) => f.scaffolded)).toEqual([true, false]);
    expect(a?.formats[0]?.gain).toBe(0.2);
    expect(scaffoldingGain(a ?? null)).toBe(0.4);
    expect(scaffoldingGain(null)).toBeNull();
  });
});

async function curriculum(db: SqlExecutor) {
  const cur = createCurriculumStore(db);
  const country = must(
    await cur.createCountry({
      code: "BJ",
      name: "Bénin",
      unitLabel: { singular: "SA", plural: "SA" },
    }),
  );
  const subject = must(
    await cur.createSubject({ code: "maths", name: "Maths" }),
  );
  const grade = must(
    await cur.createGrade({ countryId: country.id, name: "4e", position: 0 }),
  );
  const program = must(
    await cur.createProgram({ gradeId: grade.id, subjectId: subject.id }),
  );
  const unit = must(
    await cur.createUnit({
      programId: program.id,
      name: "U",
      description: "",
      position: 0,
    }),
  );
  const a = must(
    await cur.createNotion({
      unitId: unit.id,
      code: "a",
      name: "A",
      description: "A",
      position: 0,
    }),
  );
  const b = must(
    await cur.createNotion({
      unitId: unit.id,
      code: "b",
      name: "B",
      description: "B",
      position: 1,
    }),
  );
  const m = must(
    await cur.createMisconception({
      notionId: a,
      description: "Change de signe",
    }),
  );
  return { country, subject, a, b, m };
}

async function answer(
  db: SqlExecutor,
  learnerId: string,
  notionId: string,
  correct: boolean,
  at: number,
  misconceptionId: string | null = null,
) {
  await db.query(
    `INSERT INTO learning_events (id, learner_id, occurred_at, source, type, payload)
     VALUES ($1, $2, $3, 'web', 'answer.submitted', $4)`,
    [
      randomUUID(),
      learnerId,
      new Date(Date.UTC(2026, 10, 1, 8, at)).toISOString(),
      JSON.stringify({
        type: "answer.submitted",
        notionId,
        correct,
        hintsUsed: 0,
        misconceptionId,
        exerciseRef: null,
        response: null,
        misconceptionSource: null,
        misconceptionConfidence: null,
        scaffolded: true,
      }),
    ],
  );
}

describe("agrégats collectifs en base", () => {
  it("calcule sur tous les élèves, sans identifiant, et masque une notion sous le seuil", async () => {
    const db = fromPglite(new PGlite());
    await migrate(db);
    const { a, b, m, country } = await curriculum(db);
    for (let i = 0; i < 12; i++) {
      const learner = randomUUID();
      // Les 3 premiers élèves sont bloqués : trois réponses fausses.
      const stuck = i < 3;
      await answer(db, learner, a, false, 0, i < 10 ? m.id : null);
      await answer(db, learner, a, !stuck, 1);
      await answer(db, learner, a, !stuck, 2);
      if (i < 9) await answer(db, learner, b, true, 3);
    }
    const store = createCollectiveStore(db);
    const result = await store.compute(new Date("2026-11-02T00:00:00Z"), 1);
    expect(result).toEqual({ notions: 1, minLearners: 10 });

    const [insight] = await store.forNotions([a, b]);
    expect(insight).toMatchObject({
      notionId: a,
      learners: 12,
      answers: 36,
      stuckRate: 0.25,
      minLearners: 10,
      countryName: "Bénin",
      subjectName: "Maths",
    });
    expect(insight?.misconceptions).toEqual([
      {
        misconceptionId: m.id,
        description: "Change de signe",
        learners: 10,
        share: 0.833,
      },
    ]);
    // Aucun identifiant d'élève ni d'organisation dans ce qui est stocké.
    const { rows } = await db.query<{ row: string }>(
      "SELECT row_to_json(ci)::text AS row FROM collective_insights ci",
    );
    const learnerIds = await db.query<{ id: string }>(
      "SELECT DISTINCT learner_id::text AS id FROM learning_events",
    );
    for (const l of learnerIds.rows)
      expect(rows[0]?.row.includes(l.id)).toBe(false);

    expect(await store.list({ countryId: country.id })).toHaveLength(1);
    expect(await store.list({ countryId: randomUUID() })).toHaveLength(0);

    // Un nouveau calcul remplace le précédent.
    await store.compute(new Date("2026-11-03T00:00:00Z"));
    expect((await store.lastComputedAt())?.toISOString()).toBe(
      "2026-11-03T00:00:00.000Z",
    );
  });
});
