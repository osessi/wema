import { PGlite } from "@electric-sql/pglite";
import { asCountryCode, asCountryId, asNotionId } from "@wema/domain";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createCurriculumStore,
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

async function program(
  store: ReturnType<typeof createCurriculumStore>,
  code: string,
) {
  const country = must(
    await store.createCountry({
      code,
      name: code,
      unitLabel: { singular: "Chapitre", plural: "Chapitres" },
    }),
  );
  const subjects = await store.listSubjects();
  const subject =
    subjects[0] ??
    must(await store.createSubject({ code: "maths", name: "Mathématiques" }));
  const grade = must(
    await store.createGrade({ countryId: country.id, name: "4e", position: 0 }),
  );
  const prog = must(
    await store.createProgram({ gradeId: grade.id, subjectId: subject.id }),
  );
  const unit = must(
    await store.createUnit({
      programId: prog.id,
      name: "U1",
      description: "",
      position: 0,
    }),
  );
  return { country, subject, grade, prog, unit };
}

describe("référentiel en base", () => {
  it("construit un programme et le relit en entier", async () => {
    const store = createCurriculumStore(db);
    const { country, unit } = await program(store, "FR");
    const a = must(
      await store.createNotion({
        unitId: unit.id,
        code: "a",
        name: "A",
        description: "A",
        position: 0,
      }),
    );
    const b = must(
      await store.createNotion({
        unitId: unit.id,
        code: "b",
        name: "B",
        description: "B",
        position: 1,
      }),
    );
    must(await store.setPrerequisites(b, [a]));
    must(
      await store.createMisconception({
        notionId: b,
        description: "Erreur typique",
      }),
    );

    const loaded = await store.loadCountry(country.id);
    expect(loaded?.country.code).toBe("FR");
    expect(loaded?.notions.map((n) => n.code)).toEqual(["a", "b"]);
    expect(loaded?.notions[1]?.prerequisites).toEqual([a]);
    expect(
      loaded?.notions[1]?.misconceptions.map((m) => m.description),
    ).toEqual(["Erreur typique"]);
  });

  it("refuse un code de notion en double dans le pays, l'accepte dans un autre pays", async () => {
    const store = createCurriculumStore(db);
    const fr = await program(store, "FR");
    const bj = await program(store, "BJ");
    const input = {
      code: "pythagore",
      name: "P",
      description: "P",
      position: 0,
    };
    must(await store.createNotion({ ...input, unitId: fr.unit.id }));
    expect(
      (await store.createNotion({ ...input, unitId: fr.unit.id })).ok,
    ).toBe(false);
    expect(
      (await store.createNotion({ ...input, unitId: bj.unit.id })).ok,
    ).toBe(true);
  });

  it("la base refuse un prérequis d'un autre pays", async () => {
    const store = createCurriculumStore(db);
    const fr = await program(store, "FR");
    const bj = await program(store, "BJ");
    const a = must(
      await store.createNotion({
        unitId: fr.unit.id,
        code: "a",
        name: "A",
        description: "A",
        position: 0,
      }),
    );
    const b = must(
      await store.createNotion({
        unitId: bj.unit.id,
        code: "b",
        name: "B",
        description: "B",
        position: 0,
      }),
    );
    const result = await store.setPrerequisites(a, [b]);
    expect(result.ok ? "ok" : result.error.kind).toBe("invalid_reference");
    expect(
      (await store.loadCountry(fr.country.id))?.notions[0]?.prerequisites,
    ).toEqual([]);
  });

  it("archive une notion sans la supprimer, puis la restaure", async () => {
    const store = createCurriculumStore(db);
    const { country, unit } = await program(store, "FR");
    const a = must(
      await store.createNotion({
        unitId: unit.id,
        code: "a",
        name: "A",
        description: "A",
        position: 0,
      }),
    );
    const fields = {
      unitId: unit.id,
      code: "a",
      name: "A",
      description: "A",
      position: 0,
      verified: true,
    };
    must(await store.updateNotion(a, { ...fields, archived: true }));
    expect((await store.loadCountry(country.id))?.notions[0]).toMatchObject({
      archived: true,
      verified: true,
    });
    must(await store.updateNotion(a, { ...fields, archived: false }));
    expect((await store.loadCountry(country.id))?.notions[0]?.archived).toBe(
      false,
    );
  });

  it("signale une notion inconnue", async () => {
    const store = createCurriculumStore(db);
    const result = await store.setPrerequisites(
      asNotionId("00000000-0000-4000-8000-000000000999"),
      [],
    );
    expect(result).toEqual({ ok: false, error: { kind: "not_found" } });
  });

  it("importe un référentiel deux fois sans doublon", async () => {
    const store = createCurriculumStore(db);
    const countryId = asCountryId("00000000-0000-4000-8000-000000000001");
    const rows = {
      country: {
        id: countryId,
        code: asCountryCode("FR"),
        name: "France",
        unitLabel: { singular: "Chapitre", plural: "Chapitres" },
        archived: false,
      },
      subjects: [],
      grades: [],
      programs: [],
      units: [],
      notions: [],
    };
    await store.importCountry(rows);
    await store.importCountry(rows);
    expect(await store.listCountries()).toHaveLength(1);
  });
});
