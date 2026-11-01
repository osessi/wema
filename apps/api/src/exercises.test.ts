import { describe, expect, it } from "vitest";
import { ADMIN, browser, field, testServer, text } from "./test-helpers";

// Droits et règles des exercices, avec le faux services/math (le vrai est
// testé dans exercises-math.test.ts).

const equation = {
  objective: "Résoudre une équation",
  misconceptionId: null,
  statement: "Résous {equation}.",
  task: { kind: "solve", equation: "a*x + b = c", variable: "x" },
  parameters: [{ name: "a", ranges: [{ min: 2, max: 5 }], exclude: [] }],
  constraints: [],
  steps: [],
  expected: "x = 1",
};

async function setup() {
  const server = await testServer();
  const admin = browser(server.app);
  await admin.post("/auth/login", ADMIN);
  const countryId = text(
    (
      await admin.post("/admin/curriculum/countries", {
        code: "FR",
        name: "France",
        unitLabel: { singular: "C", plural: "C" },
      })
    ).json,
    "id",
  );
  const subjectId = text(
    (
      await admin.post("/admin/curriculum/subjects", {
        code: "maths",
        name: "Maths",
      })
    ).json,
    "id",
  );
  const gradeId = text(
    (
      await admin.post(`/admin/curriculum/countries/${countryId}/grades`, {
        name: "4e",
        position: 0,
      })
    ).json,
    "id",
  );
  const programId = text(
    (await admin.post("/admin/curriculum/programs", { gradeId, subjectId }))
      .json,
    "id",
  );
  const unitId = text(
    (
      await admin.post("/admin/curriculum/units", {
        programId,
        name: "U",
        description: "",
        position: 0,
      })
    ).json,
    "id",
  );
  const notionId = text(
    (
      await admin.post("/admin/curriculum/notions", {
        unitId,
        code: "eq",
        name: "Eq",
        description: "E",
        position: 0,
      })
    ).json,
    "id",
  );
  const me = text(
    (await admin.get("/auth/me")).json,
    "organizations",
    "0",
    "id",
  );

  const school = async (name: string, n: number) => {
    const id = text(
      (await admin.post("/admin/organizations", { name, kind: "school" })).json,
      "id",
    );
    const prof = text(
      (
        await admin.post(`/admin/organizations/${id}/roles`, {
          name: "Prof",
          permissions: ["exercises.read", "exercises.write", "members.manage"],
        })
      ).json,
      "id",
    );
    const reader = text(
      (
        await admin.post(`/admin/organizations/${id}/roles`, {
          name: "Lecteur",
          permissions: ["exercises.read"],
        })
      ).json,
      "id",
    );
    const pupilRole = text(
      (
        await admin.post(`/admin/organizations/${id}/roles`, {
          name: "Élève",
          permissions: [],
        })
      ).json,
      "id",
    );
    const add = (displayName: string, roleId: string, login: unknown) =>
      admin.post(`/admin/organizations/${id}/members`, {
        displayName,
        roleId,
        login,
      });
    await add("Prof", prof, {
      kind: "email",
      email: `prof${n}@example.test`,
      password: "mot-de-passe-prof",
    });
    await add("Lecteur", reader, {
      kind: "email",
      email: `lecteur${n}@example.test`,
      password: "mot-de-passe-lect",
    });
    const pupil = await add("Élève", pupilRole, {
      kind: "username",
      username: `eleve.${n}`,
    });
    const teacher = browser(server.app);
    await teacher.post("/auth/login", {
      email: `prof${n}@example.test`,
      password: "mot-de-passe-prof",
    });
    const readerSession = browser(server.app);
    await readerSession.post("/auth/login", {
      email: `lecteur${n}@example.test`,
      password: "mot-de-passe-lect",
    });
    const learner = browser(server.app);
    await learner.post("/auth/learner", {
      username: `eleve.${n}`,
      code: text(pupil.json, "loginCode"),
    });
    return {
      id,
      teacher,
      reader: readerSession,
      learner,
      pupilId: text(pupil.json, "userId"),
    };
  };
  const a = await school("École A", 1);
  const b = await school("École B", 2);
  return { ...server, admin, notionId, platformId: me, a, b };
}

async function validatedIntent(
  s: Awaited<ReturnType<typeof setup>>["a"],
  notionId: string,
) {
  const id = text(
    (
      await s.teacher.post(`/admin/organizations/${s.id}/exercises`, {
        ...equation,
        notionId,
      })
    ).json,
    "id",
  );
  expect((await s.teacher.post(`/admin/exercises/${id}/validate`)).status).toBe(
    200,
  );
  return id;
}

describe("droits sur les exercices", () => {
  it("un prof de l'école A n'agit pas sur les exercices, la banque ni les élèves de l'école B", async () => {
    const { a, b, notionId } = await setup();
    const intentB = await validatedIntent(b, notionId);
    expect(
      (
        await a.teacher.patch(`/admin/exercises/${intentB}`, {
          ...equation,
          notionId,
        })
      ).status,
    ).toBe(403);
    expect(
      (await a.teacher.post(`/admin/exercises/${intentB}/validate`)).status,
    ).toBe(403);
    expect(
      (
        await a.teacher.post(
          `/admin/organizations/${a.id}/exercises/${intentB}/preview`,
          { level: 1, scaffolded: false },
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await a.teacher.post(
          `/admin/organizations/${b.id}/exercises/${intentB}/variants`,
          { learnerIds: [b.pupilId] },
        )
      ).status,
    ).toBe(403);

    const intentA = await validatedIntent(a, notionId);
    const generated = await a.teacher.post(
      `/admin/organizations/${a.id}/exercises/${intentA}/variants`,
      { learnerIds: [b.pupilId] },
    );
    expect(field(generated.json, "failed")).toEqual([
      { learnerId: b.pupilId, error: "not_member" },
    ]);

    const week = "2026-11-02";
    const entry = text(
      (
        await b.teacher.post(`/admin/organizations/${b.id}/bank`, {
          week,
          intentId: intentB,
        })
      ).json,
      "id",
    );
    expect(
      (
        await a.teacher.patch(`/admin/organizations/${a.id}/bank/${entry}`, {
          status: "selected",
        })
      ).status,
    ).toBe(404);
  });

  it("la simple lecture ne donne ni l'aperçu ni la réponse annoncée", async () => {
    const { a, notionId } = await setup();
    const intent = await validatedIntent(a, notionId);
    expect(
      (
        await a.reader.post(
          `/admin/organizations/${a.id}/exercises/${intent}/preview`,
          { level: 1, scaffolded: false },
        )
      ).status,
    ).toBe(403);
    const list = await a.reader.get(`/admin/organizations/${a.id}/exercises`);
    expect(JSON.stringify(list.json)).not.toContain("x = 1");
  });

  it("de la bibliothèque Wema, une école ne voit que les exercices validés", async () => {
    const { admin, a, notionId, platformId } = await setup();
    const draft = text(
      (
        await admin.post(`/admin/organizations/${platformId}/exercises`, {
          ...equation,
          notionId,
          objective: "Brouillon",
        })
      ).json,
      "id",
    );
    const shared = text(
      (
        await admin.post(`/admin/organizations/${platformId}/exercises`, {
          ...equation,
          notionId,
          objective: "Partagé",
        })
      ).json,
      "id",
    );
    await admin.post(`/admin/exercises/${shared}/validate`);
    const list = JSON.stringify(
      (await a.teacher.get(`/admin/organizations/${a.id}/exercises`)).json,
    );
    expect(list).toContain(shared);
    expect(list).not.toContain(draft);
  });
});

describe("réponses des élèves", () => {
  it("seul le premier essai compte pour le profil, et les essais sont limités", async () => {
    const { a, notionId } = await setup();
    const intent = await validatedIntent(a, notionId);
    await a.teacher.post(
      `/admin/organizations/${a.id}/exercises/${intent}/variants`,
      { learnerIds: [a.pupilId] },
    );
    const variants = field(
      (await a.learner.get("/learner/variants")).json,
      "variants",
    );
    const id = text(Array.isArray(variants) ? variants[0] : null, "id");
    const answer = (response: string) =>
      a.learner.post(`/learner/variants/${id}/answer`, {
        response,
        hintsUsed: 0,
      });

    expect((await answer("???")).status).toBe(422);
    expect(field((await answer("x = 2")).json, "attemptsLeft")).toBe(2);
    expect(field((await answer("x = 1")).json, "correct")).toBe(true);
    expect((await answer("x = 1")).status).toBe(200);
    expect((await answer("x = 1")).status).toBe(409);

    const notions = field(
      (await a.learner.get("/learner/progress")).json,
      "notions",
    );
    // Une seule observation, l'essai faux : refaire la variante ne gonfle pas la maîtrise.
    expect(
      Array.isArray(notions) &&
        notions.map((n: unknown) => field(n, "observations")),
    ).toEqual([1]);
  });

  it("un élève ne corrige pas la variante d'un autre élève", async () => {
    const { a, b, notionId } = await setup();
    const intent = await validatedIntent(a, notionId);
    await a.teacher.post(
      `/admin/organizations/${a.id}/exercises/${intent}/variants`,
      { learnerIds: [a.pupilId] },
    );
    const variants = field(
      (await a.learner.get("/learner/variants")).json,
      "variants",
    );
    const id = text(Array.isArray(variants) ? variants[0] : null, "id");
    expect(
      (
        await b.learner.post(`/learner/variants/${id}/answer`, {
          response: "1",
          hintsUsed: 0,
        })
      ).status,
    ).toBe(404);
  });
});
