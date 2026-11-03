import { describe, expect, it } from "vitest";
import { ADMIN, browser, field, testServer, text } from "./test-helpers";

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
  const notion = async (code: string, position: number) =>
    text(
      (
        await admin.post("/admin/curriculum/notions", {
          unitId,
          code,
          name: code,
          description: code,
          position,
        })
      ).json,
      "id",
    );
  const calcul = await notion("calcul", 0);
  const equations = await notion("equations", 1);
  await admin.put(`/admin/curriculum/notions/${equations}/prerequisites`, {
    prerequisites: [calcul],
  });

  const school = text(
    (
      await admin.post("/admin/organizations", {
        name: "Collège",
        kind: "school",
      })
    ).json,
    "id",
  );
  const role = async (n: string, permissions: string[]) =>
    text(
      (
        await admin.post(`/admin/organizations/${school}/roles`, {
          name: n,
          permissions,
        })
      ).json,
      "id",
    );
  const direction = await role("Direction", [
    "classes.manage",
    "members.manage",
  ]);
  const profRole = await role("Prof", ["exercises.read", "exercises.write"]);
  const pupilRole = await role("Élève", []);
  const add = async (displayName: string, roleId: string, login: unknown) =>
    text(
      (
        await admin.post(`/admin/organizations/${school}/members`, {
          displayName,
          roleId,
          login,
        })
      ).json,
      "userId",
    );
  await add("Direction", direction, {
    kind: "email",
    email: "direction@example.test",
    password: "mot-de-passe-direction",
  });
  const profId = await add("Prof Un", profRole, {
    kind: "email",
    email: "prof1@example.test",
    password: "mot-de-passe-prof1",
  });
  await add("Prof Deux", profRole, {
    kind: "email",
    email: "prof2@example.test",
    password: "mot-de-passe-prof2",
  });
  const pupil = await admin.post(`/admin/organizations/${school}/members`, {
    displayName: "Élève Un",
    roleId: pupilRole,
    login: { kind: "username", username: "eleve.un" },
  });
  const login = async (email: string, password: string) => {
    const b = browser(server.app);
    await b.post("/auth/login", { email, password });
    return b;
  };
  const learner = browser(server.app);
  await learner.post("/auth/learner", {
    username: "eleve.un",
    code: text(pupil.json, "loginCode"),
  });
  const intentId = text(
    (
      await admin.post(`/admin/organizations/${school}/exercises`, {
        notionId: calcul,
        objective: "Calculer",
        misconceptionId: null,
        statement: "Résous {equation}.",
        task: { kind: "solve", equation: "a*x = a", variable: "x" },
        parameters: [{ name: "a", ranges: [{ min: 2, max: 5 }], exclude: [] }],
        constraints: [],
        steps: [],
        expected: null,
      })
    ).json,
    "id",
  );
  await admin.post(`/admin/exercises/${intentId}/validate`);
  return {
    ...server,
    admin,
    school,
    programId,
    calcul,
    equations,
    profId,
    pupilId: text(pupil.json, "userId"),
    intentId,
    direction: await login("direction@example.test", "mot-de-passe-direction"),
    prof1: await login("prof1@example.test", "mot-de-passe-prof1"),
    prof2: await login("prof2@example.test", "mot-de-passe-prof2"),
    learner,
  };
}

describe("classes et devoirs", () => {
  it("la direction crée une classe ; seul son prof la pilote ; le devoir arrive à chaque élève et passe en tête", async () => {
    const s = await setup();
    const classId = text(
      (
        await s.direction.post(`/admin/organizations/${s.school}/classes`, {
          name: "4e A",
          programId: s.programId,
        })
      ).json,
      "id",
    );
    expect(
      (
        await s.prof1.post(`/admin/organizations/${s.school}/classes`, {
          name: "4e B",
        })
      ).status,
    ).toBe(403);
    await s.direction.post(`/admin/classes/${classId}/members`, {
      userId: s.profId,
      role: "teacher",
    });
    await s.direction.post(`/admin/classes/${classId}/members`, {
      userId: s.pupilId,
      role: "learner",
    });

    const mine = field(
      (await s.prof1.get(`/admin/organizations/${s.school}/classes`)).json,
      "classes",
    );
    expect(Array.isArray(mine) && mine.length).toBe(1);
    expect(
      field(
        (await s.prof2.get(`/admin/organizations/${s.school}/classes`)).json,
        "classes",
      ),
    ).toEqual([]);
    expect((await s.prof2.get(`/admin/classes/${classId}/map`)).status).toBe(
      403,
    );

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const assignment = await s.prof1.post(
      `/admin/classes/${classId}/assignments`,
      { intentId: s.intentId, title: "Devoir 1", dueAt: tomorrow },
    );
    expect(field(assignment.json, "created")).toBe(1);
    expect(
      (
        await s.prof1.post(`/admin/classes/${classId}/assignments`, {
          intentId: s.intentId,
          title: "Passé",
          dueAt: "2020-01-01T00:00:00Z",
        })
      ).status,
    ).toBe(422);

    const list = field(
      (await s.learner.get("/learner/assignments")).json,
      "assignments",
    );
    expect(
      Array.isArray(list) &&
        list.map((a: unknown) => [field(a, "title"), field(a, "status")]),
    ).toEqual([["Devoir 1", "todo"]]);
    const next = field((await s.learner.get("/learner/next")).json, "actions");
    expect(Array.isArray(next) && field(next[0], "kind")).toBe(
      "assignment_due",
    );
    // Une seule action par notion : le devoir (sur « calcul ») passe avant la découverte de la notion.
    expect(
      Array.isArray(next) &&
        next.filter((a: unknown) => field(a, "notionId") === s.calcul).length,
    ).toBe(1);

    const map = await s.prof1.get(`/admin/classes/${classId}/map`);
    const notions = field(map.json, "notions");
    expect(
      Array.isArray(notions) && notions.map((n: unknown) => field(n, "counts")),
    ).toEqual([
      { not_seen: 1, needs_work: 0, in_progress: 0, mastered: 0 },
      { not_seen: 1, needs_work: 0, in_progress: 0, mastered: 0 },
    ]);
    const done = field(
      (await s.prof1.get(`/admin/classes/${classId}/assignments`)).json,
      "assignments",
    );
    expect(Array.isArray(done) && field(done[0], "given")).toBe(1);

    const overview = field(
      (await s.direction.get(`/admin/organizations/${s.school}/overview`)).json,
      "classes",
    );
    expect(Array.isArray(overview) && overview[0]).toMatchObject({
      name: "4e A",
      learners: 1,
      masteredShare: 0,
    });
  });

  it("on n'inscrit pas dans une classe quelqu'un qui n'est pas membre de l'organisation", async () => {
    const s = await setup();
    const classId = text(
      (
        await s.direction.post(`/admin/organizations/${s.school}/classes`, {
          name: "4e A",
          programId: s.programId,
        })
      ).json,
      "id",
    );
    const me = text((await s.admin.get("/auth/me")).json, "user", "id");
    expect(
      (
        await s.direction.post(`/admin/classes/${classId}/members`, {
          userId: me,
          role: "learner",
        })
      ).status,
    ).toBe(404);
  });
});

describe("départs et inscriptions tardives", () => {
  it("un prof retiré de l'école perd l'accès à sa classe ; un élève inscrit après le devoir le reçoit en complétant", async () => {
    const s = await setup();
    const classId = text(
      (
        await s.direction.post(`/admin/organizations/${s.school}/classes`, {
          name: "4e A",
          programId: s.programId,
        })
      ).json,
      "id",
    );
    await s.direction.post(`/admin/classes/${classId}/members`, {
      userId: s.profId,
      role: "teacher",
    });
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const assignmentId = text(
      (
        await s.prof1.post(`/admin/classes/${classId}/assignments`, {
          intentId: s.intentId,
          title: "Devoir",
          dueAt: tomorrow,
        })
      ).json,
      "id",
    );
    // L'élève arrive après le devoir : il n'a pas encore de variante.
    await s.direction.post(`/admin/classes/${classId}/members`, {
      userId: s.pupilId,
      role: "learner",
    });
    const before = field(
      (await s.learner.get("/learner/assignments")).json,
      "assignments",
    );
    expect(Array.isArray(before) && field(before[0], "status")).toBe(
      "unavailable",
    );
    const completed = await s.prof1.post(
      `/admin/classes/${classId}/assignments/${assignmentId}/complete`,
    );
    expect(field(completed.json, "created")).toBe(1);
    const after = field(
      (await s.learner.get("/learner/assignments")).json,
      "assignments",
    );
    expect(Array.isArray(after) && field(after[0], "status")).toBe("todo");

    // Le prof quitte l'école : plus d'accès à la carte de la classe.
    const roles = field(
      (await s.admin.get(`/admin/organizations/${s.school}/roles`)).json,
      "roles",
    );
    const profRole = Array.isArray(roles)
      ? text(
          roles.find((r: unknown) => field(r, "name") === "Prof"),
          "id",
        )
      : "";
    expect(
      (
        await s.admin.delete(
          `/admin/organizations/${s.school}/members/${s.profId}/roles/${profRole}`,
        )
      ).status,
    ).toBe(200);
    expect((await s.prof1.get(`/admin/classes/${classId}/map`)).status).toBe(
      403,
    );
  });
});

describe("parents", () => {
  it("le parent voit ses enfants liés, avec leur progression ; pas ceux des autres", async () => {
    const server = await testServer();
    const admin = browser(server.app);
    await admin.post("/auth/login", ADMIN);
    const family = text(
      (
        await admin.post("/admin/organizations", {
          name: "Famille",
          kind: "family",
        })
      ).json,
      "id",
    );
    const parentRole = text(
      (
        await admin.post(`/admin/organizations/${family}/roles`, {
          name: "Parent",
          permissions: ["learners.read"],
        })
      ).json,
      "id",
    );
    const childRole = text(
      (
        await admin.post(`/admin/organizations/${family}/roles`, {
          name: "Enfant",
          permissions: [],
        })
      ).json,
      "id",
    );
    const parentId = text(
      (
        await admin.post(`/admin/organizations/${family}/members`, {
          displayName: "Parent",
          roleId: parentRole,
          login: {
            kind: "email",
            email: "parent@example.test",
            password: "mot-de-passe-parent",
          },
        })
      ).json,
      "userId",
    );
    const childId = text(
      (
        await admin.post(`/admin/organizations/${family}/members`, {
          displayName: "Enfant",
          roleId: childRole,
          login: { kind: "username", username: "enfant.un" },
        })
      ).json,
      "userId",
    );
    expect(
      (
        await admin.post(`/admin/organizations/${family}/guardianships`, {
          guardianId: parentId,
          learnerId: childId,
        })
      ).status,
    ).toBe(201);
    const parent = browser(server.app);
    await parent.post("/auth/login", {
      email: "parent@example.test",
      password: "mot-de-passe-parent",
    });
    const children = field(
      (await parent.get("/parent/children")).json,
      "children",
    );
    expect(
      Array.isArray(children) &&
        children.map((c: unknown) => field(c, "displayName")),
    ).toEqual(["Enfant"]);
    const spaces = (await parent.get("/me/spaces")).json;
    expect(field(spaces, "children")).toEqual([
      { learnerId: childId, displayName: "Enfant" },
    ]);
    expect(field(spaces, "teaching")).toEqual([]);
    const stranger = browser(server.app);
    await stranger.post("/auth/register", {
      displayName: "Autre",
      email: "autre@example.test",
      password: "mot-de-passe-autre",
    });
    expect(
      field((await stranger.get("/parent/children")).json, "children"),
    ).toEqual([]);
  });

  it("l'élève voit le chemin de sa classe : notions du programme dans l'ordre, avec son statut", async () => {
    const s = await setup();
    const classId = text(
      (
        await s.direction.post(`/admin/organizations/${s.school}/classes`, {
          name: "4e A",
          programId: s.programId,
        })
      ).json,
      "id",
    );
    expect(
      field((await s.learner.get("/learner/path")).json, "classes"),
    ).toEqual([]);
    await s.direction.post(`/admin/classes/${classId}/members`, {
      userId: s.pupilId,
      role: "learner",
    });
    const res = await s.learner.get("/learner/path");
    expect(res.status).toBe(200);
    expect(field(res.json, "classes")).toEqual([
      {
        classId,
        name: "4e A",
        notions: [
          {
            notionId: s.calcul,
            name: "calcul",
            status: "not_seen",
            mastery: null,
            observations: 0,
          },
          {
            notionId: s.equations,
            name: "equations",
            status: "not_seen",
            mastery: null,
            observations: 0,
          },
        ],
      },
    ]);
  });
});
