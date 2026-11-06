import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import {
  createAiCostStore,
  createCurriculumStore,
  fromPglite,
  migrate,
  monthStart,
  type SqlExecutor,
} from "./index";

function must<T, E>(r: { ok: true; value: T } | { ok: false; error: E }): T {
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.value;
}

async function call(
  db: SqlExecutor,
  at: string,
  cost: number,
  extra: { org?: string | null; learner?: string | null; task?: string } = {},
) {
  await db.query(
    `INSERT INTO ai_calls (id, at, task, provider, model, organization_id, learner_id, cost_usd, latency_ms, status)
     VALUES ($1, $2, $3, 'openrouter', 'm', $4, $5, $6, 100, 'ok')`,
    [
      randomUUID(),
      at,
      extra.task ?? "tutor.reply",
      extra.org ?? null,
      extra.learner ?? null,
      cost,
    ],
  );
}

describe("coûts de l'IA", () => {
  it("par jour, par organisation, par élève actif et par matière (au prorata des événements)", async () => {
    const db = fromPglite(new PGlite());
    await migrate(db);
    const org = randomUUID();
    await db.query(
      "INSERT INTO organizations (id, name, kind) VALUES ($1, 'Collège test', 'school')",
      [org],
    );
    const learner = randomUUID();
    await db.query(
      "INSERT INTO users (id, display_name) VALUES ($1, 'Élève')",
      [learner],
    );
    const cur = createCurriculumStore(db);
    const country = must(
      await cur.createCountry({
        code: "FR",
        name: "France",
        unitLabel: { singular: "Chapitre", plural: "Chapitres" },
      }),
    );
    const grade = must(
      await cur.createGrade({ countryId: country.id, name: "3e", position: 0 }),
    );
    const notionIn = async (code: string) => {
      const subject = must(await cur.createSubject({ code, name: code }));
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
      return must(
        await cur.createNotion({
          unitId: unit.id,
          code: `n-${code}`,
          name: code,
          description: code,
          position: 0,
        }),
      );
    };
    const maths = await notionIn("maths");
    const physique = await notionIn("physique");
    // Trois événements en maths, un en physique, le même jour.
    for (const notionId of [maths, maths, maths, physique]) {
      await db.query(
        `INSERT INTO learning_events (id, learner_id, occurred_at, source, type, payload)
         VALUES ($1, $2, '2026-11-02T10:00:00Z', 'web', 'hint.requested', $3)`,
        [
          randomUUID(),
          learner,
          JSON.stringify({
            type: "hint.requested",
            notionId,
            exerciseRef: null,
            level: 1,
          }),
        ],
      );
    }
    await call(db, "2026-11-02T10:05:00Z", 0.4, { org, learner });
    await call(db, "2026-11-03T09:00:00Z", 0.1, { org });
    await call(db, "2026-11-03T09:00:00Z", 0.2);

    const store = createAiCostStore(db);
    const period = {
      from: new Date("2026-11-01T00:00:00Z"),
      to: new Date("2026-11-04T00:00:00Z"),
    };
    expect(await store.daily(period)).toEqual([
      { day: "2026-11-02", calls: 1, errors: 0, costUsd: 0.4 },
      { day: "2026-11-03", calls: 2, errors: 0, costUsd: 0.3 },
    ]);
    const orgs = await store.byOrganization(period);
    expect(orgs[0]).toMatchObject({
      organizationName: "Collège test",
      calls: 2,
    });
    expect(orgs[0]?.costUsd).toBeCloseTo(0.5);
    const summary = await store.learnerSummary(period);
    expect(summary.activeLearners).toBe(1);
    expect(summary.learnerCostUsd).toBeCloseTo(0.4);
    expect(summary.costPerActiveLearnerUsd).toBeCloseTo(0.7);
    const subjects = await store.bySubject(period);
    expect(subjects.map((s) => s.subjectName)).toEqual(["maths", "physique"]);
    expect(subjects[0]?.costUsd).toBeCloseTo(0.3);
    expect(subjects[1]?.costUsd).toBeCloseTo(0.1);
    expect(subjects[0]?.costPerLearnerUsd).toBeCloseTo(0.3);

    const spent = await store.spentSince(new Date("2026-11-01T00:00:00Z"), org);
    expect(spent.global).toBeCloseTo(0.7);
    expect(spent.organization).toBeCloseTo(0.5);
  });

  it("plafonds : un global et un par organisation, modifiables ; une alerte par mois et par niveau", async () => {
    const db = fromPglite(new PGlite());
    await migrate(db);
    const org = randomUUID();
    await db.query(
      "INSERT INTO organizations (id, name, kind) VALUES ($1, 'Cours test', 'tutoring')",
      [org],
    );
    const store = createAiCostStore(db);
    await store.setCap({
      organizationId: null,
      monthlyUsd: 100,
      alertRatio: 0.8,
      updatedBy: null,
    });
    await store.setCap({
      organizationId: org,
      monthlyUsd: 10,
      alertRatio: 0.5,
      updatedBy: null,
    });
    await store.setCap({
      organizationId: org,
      monthlyUsd: 20,
      alertRatio: 0.9,
      updatedBy: null,
    });
    expect(await store.capsFor(org)).toEqual({
      global: { monthlyUsd: 100, alertRatio: 0.8 },
      organization: { monthlyUsd: 20, alertRatio: 0.9 },
    });
    expect((await store.listCaps()).map((c) => c.organizationName)).toEqual([
      null,
      "Cours test",
    ]);
    const month = monthStart(new Date("2026-11-17T12:00:00Z"));
    expect(month.toISOString()).toBe("2026-11-01T00:00:00.000Z");
    const alert = {
      organizationId: org,
      month,
      level: "blocked" as const,
      spentUsd: 21,
      capUsd: 20,
    };
    expect(await store.recordAlert(alert)).toBe(true);
    expect(await store.recordAlert(alert)).toBe(false);
    expect(await store.listAlerts(month)).toHaveLength(1);
    expect(await store.removeCap(org)).toBe(true);
    expect((await store.capsFor(org)).organization).toBeNull();
  });
});
