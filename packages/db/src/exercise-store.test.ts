import { PGlite } from "@electric-sql/pglite";
import { asLearnerId, type ExerciseTask, type NotionId } from "@wema/domain";
import { beforeEach, describe, expect, it } from "vitest";
import {
  bootstrapPlatform,
  createAccountStore,
  createCurriculumStore,
  createExerciseStore,
  fromPglite,
  migrate,
  type SqlExecutor,
} from "./index";

let db: SqlExecutor;
beforeEach(async () => {
  db = fromPglite(new PGlite());
  await migrate(db);
});

function must<T, E>(r: { ok: true; value: T } | { ok: false; error: E }): T {
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.value;
}

async function fixtures() {
  const { platform } = await bootstrapPlatform(db, { superAdmin: null });
  const author = await createAccountStore(db).createUser({
    displayName: "Prof Test",
    createdBy: null,
  });
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
    await cur.createGrade({ countryId: country.id, name: "3e", position: 0 }),
  );
  const program = must(
    await cur.createProgram({ gradeId: grade.id, subjectId: subject.id }),
  );
  const unit = must(
    await cur.createUnit({
      programId: program.id,
      name: "Équations",
      description: "",
      position: 0,
    }),
  );
  const notion = must(
    await cur.createNotion({
      unitId: unit.id,
      code: "eq",
      name: "Équations",
      description: "E",
      position: 0,
    }),
  );
  const other = must(
    await cur.createNotion({
      unitId: unit.id,
      code: "autre",
      name: "Autre",
      description: "A",
      position: 1,
    }),
  );
  const misconception = must(
    await cur.createMisconception({
      notionId: notion,
      description: "Change de signe",
    }),
  );
  const foreignMisconception = must(
    await cur.createMisconception({
      notionId: other,
      description: "Autre erreur",
    }),
  );
  return { platform, author, notion, misconception, foreignMisconception };
}

const task: ExerciseTask = {
  kind: "solve",
  equation: "a*x + b = c",
  variable: "x",
};
const content = (notionId: NotionId) => ({
  notionId,
  objective: "Résoudre une équation du premier degré",
  misconceptionId: null,
  statement: "Résous {equation}.",
  task,
  parameters: [{ name: "a", ranges: [{ min: 2, max: 9 }], exclude: [] }],
  constraints: ["Ne(a, 0)"],
  steps: [],
  expected: null,
});

describe("exercices en base", () => {
  it("crée une intention, la relit et la repasse en brouillon quand on la modifie", async () => {
    const { platform, author, notion } = await fixtures();
    const store = createExerciseStore(db);
    const intent = must(
      await store.createIntent({
        ...content(notion),
        organizationId: platform.id,
        source: "admin",
        createdBy: author.id,
      }),
    );
    expect(intent).toMatchObject({ status: "draft", task });
    must(await store.setIntentStatus(intent.id, "validated"));
    const edited = must(
      await store.updateIntent(intent.id, {
        ...content(notion),
        objective: "Autre objectif",
      }),
    );
    expect(edited.status).toBe("draft");
    expect(
      await store.listIntents({
        organizationIds: [platform.id],
        notionId: notion,
      }),
    ).toHaveLength(1);
    expect(
      await store.listIntents({
        organizationIds: [platform.id],
        status: "validated",
      }),
    ).toHaveLength(0);
  });

  it("refuse une idée fausse qui n'appartient pas à la notion de l'exercice", async () => {
    const { platform, author, notion, misconception, foreignMisconception } =
      await fixtures();
    const store = createExerciseStore(db);
    const base = {
      organizationId: platform.id,
      source: "teacher" as const,
      createdBy: author.id,
    };
    expect(
      (
        await store.createIntent({
          ...content(notion),
          misconceptionId: misconception.id,
          ...base,
        })
      ).ok,
    ).toBe(true);
    const wrong = await store.createIntent({
      ...content(notion),
      misconceptionId: foreignMisconception.id,
      ...base,
    });
    expect(wrong.ok ? "ok" : wrong.error.kind).toBe("invalid_reference");
  });

  it("enregistre une variante vérifiée, qui ne se modifie plus", async () => {
    const { platform, author, notion } = await fixtures();
    const store = createExerciseStore(db);
    const intent = must(
      await store.createIntent({
        ...content(notion),
        organizationId: platform.id,
        source: "admin",
        createdBy: author.id,
      }),
    );
    const variant = await store.createVariant({
      intentId: intent.id,
      learnerId: asLearnerId(author.id),
      seed: 4_000_000_000,
      plan: { level: 2, scaffolded: false, hintLevel: 1 },
      parameters: { a: 3 },
      statement: "Résous 3x + 2 = 11.",
      rendered: { equation: { text: "3x + 2 = 11", latex: "3 x + 2 = 11" } },
      steps: [],
      answer: { kind: "solutions", variable: "x", values: ["3"] },
      verifiedAt: new Date(),
    });
    expect(await store.getVariant(variant.id)).toMatchObject({
      seed: 4_000_000_000,
      level: 2,
      parameters: { a: 3 },
    });
    expect(
      await store.listVariantsForLearner(asLearnerId(author.id)),
    ).toHaveLength(1);
    await expect(
      db.exec("UPDATE exercise_variants SET statement = 'x'"),
    ).rejects.toThrow(/ajout seul/);
  });

  it("banque hebdomadaire : proposer deux fois ne crée pas de doublon, le prof retient ou écarte", async () => {
    const { platform, author, notion } = await fixtures();
    const store = createExerciseStore(db);
    const intent = must(
      await store.createIntent({
        ...content(notion),
        organizationId: platform.id,
        source: "admin",
        createdBy: author.id,
      }),
    );
    const week = "2026-11-02";
    const id = must(
      await store.proposeForWeek({
        organizationId: platform.id,
        week,
        intent,
        proposedBy: null,
      }),
    );
    expect(
      must(
        await store.proposeForWeek({
          organizationId: platform.id,
          week,
          intent,
          proposedBy: null,
        }),
      ),
    ).toBe(id);
    must(
      await store.decideBankEntry({
        id,
        organizationId: platform.id,
        status: "selected",
        decidedBy: author.id,
      }),
    );
    expect(await store.listBank({ organizationId: platform.id, week })).toEqual(
      [
        expect.objectContaining({
          status: "selected",
          week,
          intentId: intent.id,
        }),
      ],
    );
    await expect(
      store.proposeForWeek({
        organizationId: platform.id,
        week: "2026-11-04",
        intent,
        proposedBy: null,
      }),
    ).rejects.toThrow();
  });
});
