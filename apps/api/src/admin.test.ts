import { describe, expect, it } from "vitest";
import { ADMIN, browser, field, testServer, text } from "./test-helpers";

async function adminSession() {
  const server = await testServer();
  const admin = browser(server.app);
  expect((await admin.post("/auth/login", ADMIN)).status).toBe(200);
  return { ...server, admin };
}

describe("référentiel par le back-office", () => {
  it("un super admin construit un programme, et un cycle de prérequis est refusé", async () => {
    const { admin } = await adminSession();
    const country = await admin.post("/admin/curriculum/countries", {
      code: "bj",
      name: "Bénin",
      unitLabel: {
        singular: "Situation d'apprentissage",
        plural: "Situations d'apprentissage",
      },
    });
    const countryId = text(country.json, "id");
    const subjectId = text(
      (
        await admin.post("/admin/curriculum/subjects", {
          code: "maths",
          name: "Mathématiques",
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
          name: "Pythagore",
          description: "",
          position: 0,
        })
      ).json,
      "id",
    );
    const notion = (code: string, position: number) =>
      admin.post("/admin/curriculum/notions", {
        unitId,
        code,
        name: code,
        description: `Notion ${code}`,
        position,
      });
    const a = text((await notion("carres", 0)).json, "id");
    const b = text((await notion("pythagore", 1)).json, "id");

    expect(
      (
        await admin.put(`/admin/curriculum/notions/${b}/prerequisites`, {
          prerequisites: [a],
        })
      ).status,
    ).toBe(200);
    const cycle = await admin.put(
      `/admin/curriculum/notions/${a}/prerequisites`,
      { prerequisites: [b] },
    );
    expect(cycle.status).toBe(422);
    expect(field(cycle.json, "error", "code")).toBe("invalid_prerequisites");
    expect(
      (
        await admin.post(`/admin/curriculum/notions/${b}/misconceptions`, {
          description: "Oublie la racine.",
        })
      ).status,
    ).toBe(200);

    const curriculum = await admin.get(
      `/admin/curriculum/countries/${countryId}/curriculum`,
    );
    expect(field(curriculum.json, "country", "unitLabel", "singular")).toBe(
      "Situation d'apprentissage",
    );
    const notions = field(curriculum.json, "notions");
    expect(Array.isArray(notions) && notions.length).toBe(2);

    const duplicate = await notion("pythagore", 2);
    expect(duplicate.status).toBe(409);

    const audit = await admin.get("/admin/audit");
    const entries = field(audit.json, "entries");
    const actions = Array.isArray(entries)
      ? entries.map((e: unknown) => field(e, "action"))
      : [];
    expect(actions).toContain("notion.prerequisites");
    expect(actions).toContain("country.create");
  });

  it("refuse un appel sans session et une écriture venue d'une autre origine", async () => {
    const { app, admin } = await adminSession();
    expect((await browser(app).get("/admin/curriculum/countries")).status).toBe(
      401,
    );
    const res = await app.request("/api/admin/curriculum/subjects", {
      method: "POST",
      headers: {
        origin: "https://site-malveillant.example",
        "content-type": "application/json",
      },
      body: JSON.stringify({ code: "x", name: "X" }),
    });
    expect(res.status).toBe(403);
    expect((await admin.get("/admin/curriculum/countries")).status).toBe(200);
  });
});

describe("rôles configurables", () => {
  it("un prof d'école lit le référentiel mais ne peut pas l'écrire", async () => {
    const { app, admin } = await adminSession();
    const schoolId = text(
      (
        await admin.post("/admin/organizations", {
          name: "École Exemple",
          kind: "school",
        })
      ).json,
      "id",
    );
    const roleId = text(
      (
        await admin.post(`/admin/organizations/${schoolId}/roles`, {
          name: "Prof",
          permissions: [
            "curriculum.read",
            "curriculum.write",
            "permission.inconnue",
          ],
        })
      ).json,
      "id",
    );
    const created = await admin.post(
      `/admin/organizations/${schoolId}/members`,
      {
        displayName: "Prof Exemple",
        roleId,
        login: {
          kind: "email",
          email: "prof@example.test",
          password: "mot-de-passe-prof",
        },
      },
    );
    expect(created.status).toBe(201);

    const prof = browser(app);
    expect(
      (
        await prof.post("/auth/login", {
          email: "prof@example.test",
          password: "mot-de-passe-prof",
        })
      ).status,
    ).toBe(200);
    expect((await prof.get("/admin/curriculum/countries")).status).toBe(200);
    // curriculum.write est de portée plateforme : sans effet dans une école.
    expect(
      (
        await prof.post("/admin/curriculum/subjects", {
          code: "svt",
          name: "SVT",
        })
      ).status,
    ).toBe(403);
    expect(
      (await prof.get(`/admin/organizations/${schoolId}/members`)).status,
    ).toBe(403);
    const me = await prof.get("/auth/me");
    // Les permissions de /me sont celles de la plateforme ; celles de l'école
    // sont listées par organisation.
    expect(field(me.json, "permissions")).toEqual([]);
  });

  it("personne ne retire ses propres rôles (ce qui protège aussi le dernier super admin)", async () => {
    const { admin, platformId, superAdminRoleId } = await adminSession();
    const me = await admin.get("/auth/me");
    const userId = text(me.json, "user", "id");
    const res = await admin.delete(
      `/admin/organizations/${platformId}/members/${userId}/roles/${superAdminRoleId}`,
    );
    expect(res.status).toBe(403);
  });

  it("un compte élève créé par l'école se connecte avec son identifiant et son code", async () => {
    const { app, admin } = await adminSession();
    const schoolId = text(
      (
        await admin.post("/admin/organizations", {
          name: "École Exemple",
          kind: "school",
        })
      ).json,
      "id",
    );
    const roleId = text(
      (
        await admin.post(`/admin/organizations/${schoolId}/roles`, {
          name: "Élève",
          permissions: [],
        })
      ).json,
      "id",
    );
    const created = await admin.post(
      `/admin/organizations/${schoolId}/members`,
      {
        displayName: "Élève Exemple",
        roleId,
        login: { kind: "username", username: "eleve.exemple" },
      },
    );
    const code = text(created.json, "loginCode");
    const learner = browser(app);
    expect(
      (
        await learner.post("/auth/learner", {
          username: "eleve.exemple",
          code: "mauvais1",
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await learner.post("/auth/learner", {
          username: "Eleve.Exemple",
          code: code.toUpperCase(),
        })
      ).status,
    ).toBe(200);
    expect(
      text((await learner.get("/auth/me")).json, "user", "displayName"),
    ).toBe("Élève Exemple");
    const again = await admin.post(`/admin/organizations/${schoolId}/members`, {
      displayName: "Autre",
      roleId,
      login: { kind: "username", username: "eleve.exemple" },
    });
    expect(again.status).toBe(409);
  });
});

describe("réglages pédagogiques", () => {
  it("refuse des seuils incohérents et enregistre des seuils valides", async () => {
    const { admin } = await adminSession();
    const current = await admin.get("/admin/settings/pedagogy");
    const settings = field(current.json, "settings");
    expect(field(settings, "reconfirmDelayHours")).toBe(72);
    const bad = await admin.put("/admin/settings/pedagogy", {
      ...Object(settings),
      inProgressThreshold: 0.99,
    });
    expect(bad.status).toBe(422);
    const good = await admin.put("/admin/settings/pedagogy", {
      ...Object(settings),
      reconfirmDelayHours: 48,
    });
    expect(good.status).toBe(200);
    expect(
      field(
        (await admin.get("/admin/settings/pedagogy")).json,
        "settings",
        "reconfirmDelayHours",
      ),
    ).toBe(48);
  });
});
