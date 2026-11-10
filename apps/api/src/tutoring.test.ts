import { describe, expect, it } from "vitest";
import { browser, field, testServer, text } from "./test-helpers";

const list = (json: unknown, ...path: string[]): unknown[] => {
  const v = field(json, ...path);
  return Array.isArray(v) ? v : [];
};

type App = Awaited<ReturnType<typeof testServer>>["app"];

/** Un prof particulier qui s'inscrit seul et crée son organisation. */
async function tutor(app: App, n = 1) {
  const b = browser(app);
  const res = await b.post("/auth/register", {
    displayName: `Prof ${n}`,
    email: `prof${n}@example.test`,
    password: "mot-de-passe-prof",
    birthYear: 1980,
    acceptTerms: true,
  });
  expect(res.status).toBe(201);
  const created = await b.post("/tutoring", {});
  expect(created.status).toBe(201);
  return { b, orgId: text(created.json, "id") };
}

describe("prof particulier autonome", () => {
  it("crée son organisation : responsable et prof, une seule fois", async () => {
    const { app } = await testServer();
    const { b, orgId } = await tutor(app);
    const me = await b.get("/auth/me");
    const org = list(me.json, "organizations").find(
      (o) => field(o, "id") === orgId,
    );
    expect(field(org, "kind")).toBe("tutoring");
    expect(field(org, "name")).toBe("Cours de Prof 1");
    expect(field(org, "permissions")).toEqual(
      expect.arrayContaining([
        "members.manage",
        "classes.manage",
        "exercises.write",
      ]),
    );
    expect((await b.post("/tutoring", {})).status).toBe(409);
    const state = await b.get("/tutoring");
    expect(field(state.json, "organization", "id")).toBe(orgId);
    expect(list(state.json, "learners")).toEqual([]);
  });

  it("un compte d'élève créé par une organisation ne fonde pas la sienne", async () => {
    const { app } = await testServer();
    const { b, orgId } = await tutor(app);
    const imported = await b.post(
      `/admin/organizations/${orgId}/roster/import`,
      {
        text: "Awa;Dossou",
      },
    );
    expect(imported.status).toBe(201);
    const [learner] = list(imported.json, "created");
    const child = browser(app);
    expect(
      (
        await child.post("/auth/learner", {
          username: text(learner, "username"),
          code: text(learner, "code"),
        })
      ).status,
    ).toBe(200);
    expect((await child.post("/tutoring", {})).status).toBe(403);
  });
});

describe("inscription d'élèves en masse", () => {
  it("aperçu ligne par ligne, puis création : codes, classe, parents liés", async () => {
    const { app } = await testServer();
    const { b, orgId } = await tutor(app);
    const klass = await b.post(`/admin/organizations/${orgId}/classes`, {
      name: "Groupe du mercredi",
    });
    const classId = text(klass.json, "id");

    const preview = await b.post(
      `/admin/organizations/${orgId}/roster/preview`,
      {
        text: "Prénom;Nom;Classe;E-mail du parent\nAwa;Dossou;;\nAwa;Dossou;;\nKofi;Mensah;Inconnue;\nAmi;Diallo;;mauvais",
        classId,
      },
    );
    expect(preview.status).toBe(200);
    expect(list(preview.json, "rows").map((r) => field(r, "errors"))).toEqual([
      [],
      ["duplicate_learner"],
      ["class_not_found"],
      ["invalid_parent_email"],
    ]);
    // Une ligne en erreur : rien n'est créé.
    expect(
      (
        await b.post(`/admin/organizations/${orgId}/roster/import`, {
          text: "Awa;Dossou\nAwa;Dossou",
        })
      ).status,
    ).toBe(422);

    const imported = await b.post(
      `/admin/organizations/${orgId}/roster/import`,
      {
        text: "Awa;Dossou;;famille.dossou@example.test\nAmi;Dossou;Groupe du mercredi;famille.dossou@example.test\nKofi;Mensah",
        classId,
        createParents: true,
      },
    );
    expect(imported.status).toBe(201);
    const created = list(imported.json, "created");
    expect(created.map((k) => field(k, "username"))).toEqual([
      "awa.dossou",
      "ami.dossou",
      "kofi.mensah",
    ]);
    expect(
      created.every((k) => field(k, "className") === "Groupe du mercredi"),
    ).toBe(true);
    // Frères et sœurs : un seul compte parent, un seul code.
    expect(field(created[0], "parent", "code")).toBe(
      field(created[1], "parent", "code"),
    );
    expect(field(created[2], "parent")).toBeNull();

    // Même liste importée à nouveau : déjà inscrits.
    const again = await b.post(`/admin/organizations/${orgId}/roster/preview`, {
      text: "Kofi;Mensah",
    });
    expect(field(list(again.json, "rows")[0], "errors")).toEqual([
      "already_member",
    ]);

    // L'élève se connecte avec son identifiant et son code, et est dans le groupe.
    const learner = browser(app);
    expect(
      (
        await learner.post("/auth/learner", {
          username: "kofi.mensah",
          code: text(created[2], "code"),
        })
      ).status,
    ).toBe(200);
    expect(
      list((await learner.get("/me/spaces")).json, "learning").map((k) =>
        field(k, "id"),
      ),
    ).toEqual([classId]);

    // Le parent se connecte avec son identifiant (jamais l'e-mail saisi par
    // l'organisation) et son code, et suit ses deux enfants.
    const parent = browser(app);
    expect(
      (
        await parent.post("/auth/learner", {
          username: text(created[0], "parent", "login"),
          code: text(created[0], "parent", "code"),
        })
      ).status,
    ).toBe(200);
    expect(
      list((await parent.get("/me/spaces")).json, "children")
        .map((k) => field(k, "displayName"))
        .sort(),
    ).toEqual(["Ami Dossou", "Awa Dossou"]);

    // Parent créé un par un, sans e-mail : identifiant et code.
    const single = await b.post(
      `/admin/organizations/${orgId}/learners/${text(created[2], "userId")}/guardian`,
      {},
    );
    expect(single.status).toBe(201);
    expect(field(single.json, "kind")).toBe("username");
    const parent2 = browser(app);
    expect(
      (
        await parent2.post("/auth/learner", {
          username: text(single.json, "login"),
          code: text(single.json, "code"),
        })
      ).status,
    ).toBe(200);
    expect(
      list((await parent2.get("/me/spaces")).json, "children").map((k) =>
        field(k, "displayName"),
      ),
    ).toEqual(["Kofi Mensah"]);
    const state = await b.get("/tutoring");
    expect(
      list(state.json, "learners").map((l) => field(l, "guardians")),
    ).toEqual([1, 1, 1]);
  });

  it("l'aperçu ne dit pas si l'e-mail d'un parent a un compte ; l'import rattache ou reste générique", async () => {
    const { app } = await testServer();
    const { b, orgId } = await tutor(app);
    const other = browser(app);
    expect(
      (
        await other.post("/auth/register", {
          displayName: "Déjà inscrit",
          email: "deja.inscrit@example.test",
          password: "mot-de-passe-solide",
          birthYear: 1980,
          acceptTerms: true,
        })
      ).status,
    ).toBe(201);
    const preview = async (email: string) => {
      const res = await b.post(`/admin/organizations/${orgId}/roster/preview`, {
        text: `Awa;Dossou;;${email}`,
      });
      expect(res.status).toBe(200);
      const row = list(res.json, "rows")[0];
      return { errors: field(row, "errors"), keys: Object.keys(row ?? {}) };
    };
    expect(await preview("deja.inscrit@example.test")).toEqual(
      await preview("inconnu@example.test"),
    );

    // E-mail inscrit mais sans lien avec l'organisation : pas de compte parent.
    const imported = await b.post(
      `/admin/organizations/${orgId}/roster/import`,
      {
        text: "Awa;Dossou;;deja.inscrit@example.test\nKofi;Mensah;;famille.mensah@example.test",
        createParents: true,
      },
    );
    expect(imported.status).toBe(201);
    const created = list(imported.json, "created");
    expect(field(created[0], "parent")).toBeNull();
    expect(field(created[0], "parentNotice")).toBe("not_created");
    expect(field(created[1], "parentNotice")).toBeNull();
    expect(text(created[1], "parent", "login")).not.toContain("@");
  });

  it("ajout d'un parent : un e-mail inscrit reçoit une réponse générique, sans dire qu'il existe", async () => {
    const { app } = await testServer();
    const { b, orgId } = await tutor(app);
    for (const email of [
      "inscrit.un@example.test",
      "inscrit.deux@example.test",
    ])
      expect(
        (
          await browser(app).post("/auth/register", {
            displayName: "Inscrit",
            email,
            password: "mot-de-passe-solide",
            birthYear: 1980,
            acceptTerms: true,
          })
        ).status,
      ).toBe(201);
    const imported = await b.post(
      `/admin/organizations/${orgId}/roster/import`,
      {
        text: "Awa;Dossou\nKofi;Mensah\nAmi;Diallo",
      },
    );
    const [awa, kofi, ami] = list(imported.json, "created").map((k) =>
      text(k, "userId"),
    );
    const add = (learnerId: string | undefined, email: string) =>
      b.post(`/admin/organizations/${orgId}/learners/${learnerId}/guardian`, {
        email,
      });
    const one = await add(awa, "inscrit.un@example.test");
    const two = await add(kofi, "inscrit.deux@example.test");
    expect({ status: one.status, json: one.json }).toEqual({
      status: two.status,
      json: two.json,
    });
    expect(one.json).toEqual({ ok: true, parentNotice: "not_created" });
    expect(JSON.stringify(one.json)).not.toContain("taken");
    // Inconnu : le compte est créé, avec son code.
    const created = await add(ami, "nouveau.parent@example.test");
    expect(created.status).toBe(201);
    // Jamais l'e-mail saisi par l'organisation : un identifiant.
    expect(field(created.json, "login")).not.toContain("@");
  });

  it("refuse une organisation qu'on ne gère pas, et un élève d'une autre", async () => {
    const { app } = await testServer();
    const one = await tutor(app, 1);
    const two = await tutor(app, 2);
    expect(
      (
        await two.b.post(`/admin/organizations/${one.orgId}/roster/preview`, {
          text: "Awa;Dossou",
        })
      ).status,
    ).toBe(403);
    const imported = await one.b.post(
      `/admin/organizations/${one.orgId}/roster/import`,
      { text: "Awa;Dossou" },
    );
    const learnerId = text(list(imported.json, "created")[0], "userId");
    expect(
      (
        await two.b.post(
          `/admin/organizations/${two.orgId}/learners/${learnerId}/guardian`,
          {},
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await two.b.put(`/tutoring/${one.orgId}/onboarding/parents`, {
          status: "skipped",
        })
      ).status,
    ).toBe(403);
  });

  it("refuse un texte trop long", async () => {
    const { app } = await testServer();
    const { b, orgId } = await tutor(app);
    const res = await b.post(`/admin/organizations/${orgId}/roster/preview`, {
      text: Array.from({ length: 101 }, (_, i) => `A${i};B`).join("\n"),
    });
    expect(res.status).toBe(422);
    expect(field(res.json, "error", "code")).toBe("roster_too_many_rows");
  });
});
