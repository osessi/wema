import { describe, expect, it } from "vitest";
import { ADMIN, browser, field, testServer, text } from "./test-helpers";

const PASSWORD = "mot-de-passe-parent";

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

const list = (json: unknown, ...path: string[]): unknown[] => {
  const v = field(json, ...path);
  return Array.isArray(v) ? v : [];
};

/** Référentiel : un pays, deux niveaux de la même matière, une notion chacun. */
async function setup() {
  const server = await testServer();
  const admin = browser(server.app);
  await admin.post("/auth/login", ADMIN);
  const post = async (path: string, body: unknown) =>
    text((await admin.post(path, body)).json, "id");
  const countryId = await post("/admin/curriculum/countries", {
    code: "FR",
    name: "France",
    unitLabel: { singular: "Chapitre", plural: "Chapitres" },
  });
  const subjectId = await post("/admin/curriculum/subjects", {
    code: "maths",
    name: "Mathématiques",
  });
  const program = async (grade: string, position: number) => {
    const gradeId = await post(
      `/admin/curriculum/countries/${countryId}/grades`,
      { name: grade, position },
    );
    const programId = await post("/admin/curriculum/programs", {
      gradeId,
      subjectId,
    });
    const unitId = await post("/admin/curriculum/units", {
      programId,
      name: "U",
      description: "",
      position: 0,
    });
    const notionId = await post("/admin/curriculum/notions", {
      unitId,
      code: `eq-${grade}`,
      name: `Équations ${grade}`,
      description: "E",
      position: 0,
    });
    return { programId, notionId };
  };
  const fourth = await program("4e", 0);
  const third = await program("3e", 1);
  return { ...server, admin, countryId, subjectId, fourth, third };
}

async function parent(app: Awaited<ReturnType<typeof setup>>["app"], n = 1) {
  const b = browser(app);
  const res = await b.post("/auth/register", {
    displayName: `Parent ${n}`,
    email: `parent${n}@example.test`,
    password: PASSWORD,
    birthYear: 1985,
    acceptTerms: true,
  });
  expect(res.status).toBe(201);
  return b;
}

describe("rôles par défaut d'une organisation", () => {
  it("le back-office crée les rôles du type ; ils restent modifiables", async () => {
    const { admin } = await setup();
    const roles = async (kind: string) => {
      const id = text(
        (
          await admin.post("/admin/organizations", {
            name: `Orga ${kind}`,
            kind,
            defaultRoles: true,
          })
        ).json,
        "id",
      );
      const json = (await admin.get(`/admin/organizations/${id}/roles`)).json;
      return { id, roles: list(json, "roles") };
    };
    const family = await roles("family");
    expect(family.roles.map((r) => field(r, "name")).sort()).toEqual([
      "Enfant",
      "Parent",
    ]);
    expect(field(family.roles[1], "permissions")).toEqual(
      expect.arrayContaining(["members.manage", "learners.health.write"]),
    );
    expect(
      (await roles("school")).roles.map((r) => field(r, "name")).sort(),
    ).toEqual(["Direction", "Prof", "Élève"].sort());
    expect(
      (await roles("tutoring")).roles.map((r) => field(r, "name")).sort(),
    ).toEqual(["Prof", "Responsable", "Élève"].sort());
    // Modifiable comme tout rôle.
    const child = family.roles.find((r) => field(r, "name") === "Enfant");
    expect(
      (
        await admin.patch(`/admin/roles/${text(child, "id")}`, {
          name: "Ado",
          permissions: ["curriculum.read"],
        })
      ).status,
    ).toBe(200);
  });

  it("sans le drapeau, l'organisation naît sans rôle (scripts existants)", async () => {
    const { admin } = await setup();
    const id = text(
      (await admin.post("/admin/organizations", { name: "X", kind: "school" }))
        .json,
      "id",
    );
    expect(
      list((await admin.get(`/admin/organizations/${id}/roles`)).json, "roles"),
    ).toEqual([]);
  });
});

describe("parcours famille autonome", () => {
  it("un parent inscrit seul crée sa famille, une seule", async () => {
    const { app } = await setup();
    const p = await parent(app);
    const before = (await p.get("/family")).json;
    expect(field(before, "canCreate")).toBe(true);
    expect(list(before, "catalog")).toHaveLength(2);
    const created = await p.post("/family", {});
    expect(created.status).toBe(201);
    const familyId = text(created.json, "id");
    // Il en devient « Parent » : il gère la famille.
    const me = (await p.get("/auth/me")).json;
    expect(
      list(me, "organizations").some(
        (o) => field(o, "id") === familyId && field(o, "kind") === "family",
      ),
    ).toBe(true);
    expect(
      (await p.get(`/admin/organizations/${familyId}/members`)).status,
    ).toBe(200);
    // La route générale des membres ne sert pas à contourner les plafonds
    // du parcours famille.
    expect(
      (
        await p.post(`/admin/organizations/${familyId}/members`, {
          displayName: "Enfant hors parcours",
          roleId: familyId,
          login: { kind: "username", username: "enfant.hors.parcours" },
        })
      ).status,
    ).toBe(403);
    const again = await p.post("/family", { name: "Deuxième" });
    expect(again.status).toBe(409);
    expect(field(again.json, "error", "code")).toBe("family_exists");
    expect(field((await p.get("/family")).json, "canCreate")).toBe(false);
  });

  it("ajoute un enfant : identifiant et code une fois, consentement, programme", async () => {
    const s = await setup();
    const p = await parent(s.app);
    const familyId = text((await p.post("/family", {})).json, "id");
    const res = await p.post(`/family/${familyId}/children`, {
      displayName: "Léa",
      login: { kind: "username", username: "lea-test" },
      programIds: [s.fourth.programId],
    });
    expect(res.status).toBe(201);
    const childId = text(res.json, "userId");
    const code = text(res.json, "loginCode");
    // Consentement parental : le parent est l'auteur du lien.
    const consents = await s.db.query<{ method: string }>(
      "SELECT method FROM parental_consents WHERE learner_id = $1",
      [childId],
    );
    expect(consents.rows.map((r) => r.method)).toEqual(["guardian_link"]);
    const family = (await p.get("/family")).json;
    const child = list(family, "children")[0];
    expect(field(child, "learnerId")).toBe(childId);
    expect(field(list(child, "programs")[0], "gradeName")).toBe("4e");
    // L'enfant se connecte avec son identifiant et son code.
    const kid = browser(s.app);
    const login = await kid.post("/auth/learner", {
      username: "lea-test",
      code,
    });
    expect(login.status).toBe(200);
    // Son chemin vient du programme individuel.
    const path = (await kid.get("/learner/path")).json;
    expect(list(path, "classes").map((k) => field(k, "kind"))).toEqual([
      "individual",
    ]);
    expect(
      field(list(list(path, "classes")[0], "notions")[0], "notionId"),
    ).toBe(s.fourth.notionId);
    // Un enfant ne fonde pas de famille.
    expect((await kid.post("/family", {})).status).toBe(403);
  });

  it("un programme refusé n'ouvre aucun compte ; une matière, un pays", async () => {
    const s = await setup();
    const p = await parent(s.app);
    const familyId = text((await p.post("/family", {})).json, "id");
    const conflict = await p.post(`/family/${familyId}/children`, {
      displayName: "Léo",
      login: { kind: "username", username: "leo-test" },
      programIds: [s.fourth.programId, s.third.programId],
    });
    expect(conflict.status).toBe(422);
    expect(field(conflict.json, "error", "code")).toBe("programs_conflict");
    const missing = await p.post(`/family/${familyId}/children`, {
      displayName: "Léo",
      login: { kind: "username", username: "leo-test" },
      programIds: ["00000000-0000-4000-8000-000000000000"],
    });
    expect(field(missing.json, "error", "code")).toBe("program_not_found");
    // L'identifiant est resté libre : rien n'a été créé.
    expect(
      (
        await p.post(`/family/${familyId}/children`, {
          displayName: "Léo",
          login: { kind: "username", username: "leo-test" },
          programIds: [],
        })
      ).status,
    ).toBe(201);
  });

  it("droits : seul le parent de la famille ajoute un enfant ou change son programme", async () => {
    const s = await setup();
    const p = await parent(s.app, 1);
    const other = await parent(s.app, 2);
    const familyId = text((await p.post("/family", {})).json, "id");
    const otherFamily = text((await other.post("/family", {})).json, "id");
    const childId = text(
      (
        await p.post(`/family/${familyId}/children`, {
          displayName: "Léa",
          login: {
            kind: "email",
            email: "lea@example.test",
            password: "mot-de-passe-enfant",
          },
          programIds: [s.fourth.programId],
        })
      ).json,
      "userId",
    );
    expect(
      (
        await other.post(`/family/${familyId}/children`, {
          displayName: "Intrus",
          login: { kind: "username", username: "intrus" },
          programIds: [],
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await other.put(`/family/${familyId}/children/${childId}/programs`, {
          programIds: [s.third.programId],
        })
      ).status,
    ).toBe(403);
    // Sa propre famille ne lui donne aucun droit sur l'enfant d'une autre.
    expect(
      (
        await other.put(`/family/${otherFamily}/children/${childId}/programs`, {
          programIds: [s.third.programId],
        })
      ).status,
    ).toBe(404);
    // Un compte existant n'est jamais rattaché.
    const taken = await other.post(`/family/${otherFamily}/children`, {
      displayName: "Léa",
      login: {
        kind: "email",
        email: "lea@example.test",
        password: "mot-de-passe-enfant",
      },
      programIds: [],
    });
    expect(field(taken.json, "error", "code")).toBe("identifier_taken");
    // Le parent change le niveau.
    expect(
      (
        await p.put(`/family/${familyId}/children/${childId}/programs`, {
          programIds: [s.third.programId],
        })
      ).status,
    ).toBe(200);
    const child = list((await p.get("/family")).json, "children")[0];
    expect(field(list(child, "programs")[0], "gradeName")).toBe("3e");
  });

  it("élève sans classe : un exercice personnel vérifié, puis le chemin bouge", async () => {
    const s = await setup();
    // Un exercice validé de la bibliothèque Wema sur la notion de 4e.
    const intentId = text(
      (
        await s.admin.post(`/admin/organizations/${s.platformId}/exercises`, {
          ...equation,
          notionId: s.fourth.notionId,
        })
      ).json,
      "id",
    );
    await s.admin.post(`/admin/exercises/${intentId}/validate`);
    const p = await parent(s.app);
    const familyId = text((await p.post("/family", {})).json, "id");
    const code = text(
      (
        await p.post(`/family/${familyId}/children`, {
          displayName: "Léa",
          login: { kind: "username", username: "lea-test" },
          programIds: [s.fourth.programId],
        })
      ).json,
      "loginCode",
    );
    const kid = browser(s.app);
    await kid.post("/auth/learner", { username: "lea-test", code });
    const next = (await kid.get("/learner/next")).json;
    const first = list(next, "actions")[0];
    expect(field(first, "kind")).toBe("finish_exercise");
    const variantId = text(first, "variantId");
    // Une seule variante préparée, même en relisant.
    await kid.get("/learner/next");
    expect(
      list((await kid.get("/learner/variants")).json, "variants"),
    ).toHaveLength(1);
    const answer = await kid.post(`/learner/variants/${variantId}/answer`, {
      response: "x = 1",
      hintsUsed: 0,
    });
    expect(field(answer.json, "correct")).toBe(true);
    const path = (await kid.get("/learner/path")).json;
    const notion = list(list(path, "classes")[0], "notions")[0];
    expect(field(notion, "status")).not.toBe("not_seen");
    expect(field(notion, "observations")).toBe(1);
  });

  it("la classe reste prioritaire pour sa matière", async () => {
    const s = await setup();
    const p = await parent(s.app);
    const familyId = text((await p.post("/family", {})).json, "id");
    const childId = text(
      (
        await p.post(`/family/${familyId}/children`, {
          displayName: "Léa",
          login: { kind: "username", username: "lea-test" },
          programIds: [s.fourth.programId],
        })
      ).json,
      "userId",
    );
    // Inscrite aussi dans une classe de 3e (même matière).
    const school = text(
      (
        await s.admin.post("/admin/organizations", {
          name: "Collège",
          kind: "school",
          defaultRoles: true,
        })
      ).json,
      "id",
    );
    const pupil = list(
      (await s.admin.get(`/admin/organizations/${school}/roles`)).json,
      "roles",
    ).find((r) => field(r, "name") === "Élève");
    await s.db.query(
      "INSERT INTO memberships (user_id, organization_id, role_id) VALUES ($1, $2, $3)",
      [childId, school, text(pupil, "id")],
    );
    const classId = text(
      (
        await s.admin.post(`/admin/organizations/${school}/classes`, {
          name: "3e B",
          programId: s.third.programId,
        })
      ).json,
      "id",
    );
    await s.admin.post(`/admin/classes/${classId}/members`, {
      userId: childId,
      role: "learner",
    });
    const child = list((await p.get("/family")).json, "children")[0];
    expect(list(child, "programs").map((x) => field(x, "source"))).toEqual([
      "class",
    ]);
    expect(field(list(child, "programs")[0], "gradeName")).toBe("3e");
  });
});
