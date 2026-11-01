import { describe, expect, it } from "vitest";
import { ADMIN, browser, field, testServer, text } from "./test-helpers";

async function setup() {
  const server = await testServer();
  const admin = browser(server.app);
  await admin.post("/auth/login", ADMIN);
  const family = text(
    (
      await admin.post("/admin/organizations", {
        name: "Famille Exemple",
        kind: "family",
      })
    ).json,
    "id",
  );
  const role = async (name: string, permissions: string[]) =>
    text(
      (
        await admin.post(`/admin/organizations/${family}/roles`, {
          name,
          permissions,
        })
      ).json,
      "id",
    );
  const parentRole = await role("Parent", [
    "learners.read",
    "learners.write",
    "learners.health.read",
    "learners.health.write",
  ]);
  const tutorRole = await role("Soutien", ["learners.read"]);
  const learnerRole = await role("Élève", []);
  const add = (displayName: string, roleId: string, login: unknown) =>
    admin.post(`/admin/organizations/${family}/members`, {
      displayName,
      roleId,
      login,
    });
  await add("Parent", parentRole, {
    kind: "email",
    email: "parent@example.test",
    password: "mot-de-passe-parent",
  });
  await add("Soutien", tutorRole, {
    kind: "email",
    email: "soutien@example.test",
    password: "mot-de-passe-soutien",
  });
  const pupil = await add("Élève", learnerRole, {
    kind: "username",
    username: "eleve.famille",
  });
  const login = async (email: string, password: string) => {
    const b = browser(server.app);
    await b.post("/auth/login", { email, password });
    return b;
  };
  const learner = browser(server.app);
  await learner.post("/auth/learner", {
    username: "eleve.famille",
    code: text(pupil.json, "loginCode"),
  });
  return {
    ...server,
    family,
    pupilId: text(pupil.json, "userId"),
    parent: await login("parent@example.test", "mot-de-passe-parent"),
    support: await login("soutien@example.test", "mot-de-passe-soutien"),
    learner,
  };
}

describe("profil explicable et déclarations", () => {
  it("le parent déclare une préférence et un besoin (avec consentement) ; le profil les montre avec leur source", async () => {
    const { family, pupilId, parent } = await setup();
    const base = `/admin/organizations/${family}/learners/${pupilId}`;
    expect(
      (await parent.post(`${base}/preferences`, { key: "format.visual" }))
        .status,
    ).toBe(201);
    expect(
      (
        await parent.post(`${base}/needs`, {
          need: "need.dyslexia",
          active: true,
          consent: false,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await parent.post(`${base}/needs`, {
          need: "need.dyslexia",
          active: true,
          consent: true,
        })
      ).status,
    ).toBe(201);
    const profile = await parent.get(`${base}/profile`);
    expect(field(profile.json, "hypotheses")).toEqual([
      expect.objectContaining({
        key: "format.visual",
        sources: ["declared_guardian"],
        status: "supported",
        evidenceCount: 1,
      }),
    ]);
    expect(field(profile.json, "needs")).toEqual([
      expect.objectContaining({
        need: "need.dyslexia",
        active: true,
        declaredBy: "guardian",
      }),
    ]);
  });

  it("sans permission santé, les besoins déclarés ne sont pas montrés", async () => {
    const { family, pupilId, parent, support } = await setup();
    const base = `/admin/organizations/${family}/learners/${pupilId}`;
    await parent.post(`${base}/needs`, {
      need: "need.adhd",
      active: true,
      consent: true,
    });
    const profile = await support.get(`${base}/profile`);
    expect(profile.status).toBe(200);
    expect(field(profile.json, "needs")).toBeUndefined();
    expect(JSON.stringify(profile.json)).not.toContain("adhd");
    expect(
      (await support.post(`${base}/preferences`, { key: "format.visual" }))
        .status,
    ).toBe(403);
  });

  it("l'élève déclare un centre d'intérêt et lit son propre profil", async () => {
    const { learner } = await setup();
    expect(
      (await learner.post("/learner/preferences", { key: "interest" })).status,
    ).toBe(422);
    expect(
      (
        await learner.post("/learner/preferences", {
          key: "interest",
          label: "Football",
        })
      ).status,
    ).toBe(201);
    const profile = await learner.get("/learner/profile");
    expect(field(profile.json, "hypotheses")).toEqual([
      expect.objectContaining({
        key: "interest:football",
        sources: ["declared_learner"],
      }),
    ]);
  });

  it("on ne lit pas le profil d'un élève hors de son organisation", async () => {
    const { app, pupilId } = await setup();
    const admin = browser(app);
    await admin.post("/auth/login", ADMIN);
    const other = text(
      (
        await admin.post("/admin/organizations", {
          name: "Autre famille",
          kind: "family",
        })
      ).json,
      "id",
    );
    const roleId = text(
      (
        await admin.post(`/admin/organizations/${other}/roles`, {
          name: "Parent",
          permissions: ["learners.read"],
        })
      ).json,
      "id",
    );
    await admin.post(`/admin/organizations/${other}/members`, {
      displayName: "Autre parent",
      roleId,
      login: {
        kind: "email",
        email: "autre@example.test",
        password: "mot-de-passe-autre",
      },
    });
    const intruder = browser(app);
    await intruder.post("/auth/login", {
      email: "autre@example.test",
      password: "mot-de-passe-autre",
    });
    expect(
      (
        await intruder.get(
          `/admin/organizations/${other}/learners/${pupilId}/profile`,
        )
      ).status,
    ).toBe(404);
  });
});
