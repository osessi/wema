import { ok } from "@wema/domain";
import { describe, expect, it } from "vitest";
import type { OAuthProvider } from "./oauth";
import { ADMIN, browser, field, testServer, text } from "./test-helpers";

// Scénarios issus de la relecture indépendante du lot 2.

async function twoSchools() {
  const server = await testServer();
  const admin = browser(server.app);
  await admin.post("/auth/login", ADMIN);
  const school = async (name: string) => {
    const id = text(
      (await admin.post("/admin/organizations", { name, kind: "school" })).json,
      "id",
    );
    const director = text(
      (
        await admin.post(`/admin/organizations/${id}/roles`, {
          name: "Direction",
          permissions: ["members.manage"],
        })
      ).json,
      "id",
    );
    const learner = text(
      (
        await admin.post(`/admin/organizations/${id}/roles`, {
          name: "Élève",
          permissions: [],
        })
      ).json,
      "id",
    );
    return { id, director, learner };
  };
  const a = await school("École A");
  const b = await school("École B");
  await admin.post(`/admin/organizations/${a.id}/members`, {
    displayName: "Direction A",
    roleId: a.director,
    login: {
      kind: "email",
      email: "direction-a@example.test",
      password: "mot-de-passe-direction",
    },
  });
  const pupil = await admin.post(`/admin/organizations/${b.id}/members`, {
    displayName: "Élève B",
    roleId: b.learner,
    login: { kind: "username", username: "eleve.b" },
  });
  const directorA = browser(server.app);
  await directorA.post("/auth/login", {
    email: "direction-a@example.test",
    password: "mot-de-passe-direction",
  });
  return {
    ...server,
    admin,
    a,
    b,
    directorA,
    pupilId: text(pupil.json, "userId"),
    pupilCode: text(pupil.json, "loginCode"),
  };
}

describe("isolation entre organisations", () => {
  it("une école ne s'approprie pas un élève d'une autre école ni ne change son code", async () => {
    const { directorA, a, pupilId, app, pupilCode } = await twoSchools();
    const base = `/admin/organizations/${a.id}/members/${pupilId}`;
    expect(
      (await directorA.post(`${base}/roles`, { roleId: a.learner })).status,
    ).toBe(404);
    expect((await directorA.post(`${base}/login-code`)).status).toBe(404);
    expect(
      (
        await browser(app).post("/auth/learner", {
          username: "eleve.b",
          code: pupilCode,
        })
      ).status,
    ).toBe(200);
  });

  it("une école ne rattache pas un compte existant et n'apprend pas s'il existe", async () => {
    const { directorA, a } = await twoSchools();
    const res = await directorA.post(`/admin/organizations/${a.id}/members`, {
      displayName: "Quelqu'un",
      roleId: a.learner,
      login: { kind: "email", email: ADMIN.email },
    });
    expect(res.status).toBe(409);
    expect(field(res.json, "userId")).toBeUndefined();
    const members = await directorA.get(`/admin/organizations/${a.id}/members`);
    expect(JSON.stringify(members.json)).not.toContain(ADMIN.email);
  });

  it("gérer les membres ne permet pas de s'attribuer un rôle plus puissant", async () => {
    const { admin, directorA, a } = await twoSchools();
    const powerful = text(
      (
        await admin.post(`/admin/organizations/${a.id}/roles`, {
          name: "Admin",
          permissions: ["members.manage", "roles.manage"],
        })
      ).json,
      "id",
    );
    const me = text((await directorA.get("/auth/me")).json, "user", "id");
    expect(
      (
        await directorA.post(
          `/admin/organizations/${a.id}/members/${me}/roles`,
          { roleId: powerful },
        )
      ).status,
    ).toBe(403);
    const created = await directorA.post(
      `/admin/organizations/${a.id}/members`,
      {
        displayName: "Complice",
        roleId: powerful,
        login: {
          kind: "email",
          email: "complice@example.test",
          password: "mot-de-passe-complice",
        },
      },
    );
    expect(created.status).toBe(403);
  });

  it("le téléphone d'un membre est masqué dans la liste", async () => {
    const { admin, a } = await twoSchools();
    await admin.post(`/admin/organizations/${a.id}/members`, {
      displayName: "Parent",
      roleId: a.learner,
      login: { kind: "phone", phone: "+33612345678" },
    });
    const members = JSON.stringify(
      (await admin.get(`/admin/organizations/${a.id}/members`)).json,
    );
    expect(members).not.toContain("+33612345678");
    expect(members).toContain("…78");
  });
});

describe("comptes et sessions", () => {
  it("un nouveau code élève ferme les sessions ouvertes avec l'ancien", async () => {
    const { admin, app, b, pupilId, pupilCode } = await twoSchools();
    const thief = browser(app);
    await thief.post("/auth/learner", { username: "eleve.b", code: pupilCode });
    expect((await thief.get("/auth/me")).status).toBe(200);
    expect(
      (
        await admin.post(
          `/admin/organizations/${b.id}/members/${pupilId}/login-code`,
        )
      ).status,
    ).toBe(200);
    expect((await thief.get("/auth/me")).status).toBe(401);
  });

  it("Google ne se rattache pas à un compte dont l'e-mail n'a pas été vérifié", async () => {
    const google: OAuthProvider = {
      start: () => ({
        url: new URL("https://accounts.example/auth"),
        state: "s",
        codeVerifier: "v",
      }),
      finish: async () =>
        ok({
          subject: "g-victime",
          email: "victime@example.test",
          emailVerified: true,
          name: "Victime",
        }),
    };
    const { app } = await testServer({ google });
    const attacker = browser(app);
    await attacker.post("/auth/register", {
      displayName: "Pirate",
      email: "victime@example.test",
      password: "mot-de-passe-pirate",
    });
    const attackerId = text(
      (await attacker.get("/auth/me")).json,
      "user",
      "id",
    );

    const start = await app.request("/api/auth/oauth/google/start");
    const cookie =
      start.headers.get("set-cookie")?.match(/wema_oauth=[^;]*/)?.[0] ?? "";
    const back = await app.request(
      "/api/auth/oauth/google/callback?code=c&state=s",
      { headers: { cookie } },
    );
    const session =
      back.headers.get("set-cookie")?.match(/wema_session=[^;]*/)?.[0] ?? "";
    const me: unknown = await (
      await app.request("/api/auth/me", { headers: { cookie: session } })
    ).json();
    expect(field(me, "user", "id")).not.toBe(attackerId);
  });

  it("bloque après 10 mots de passe faux pour le même e-mail", async () => {
    const { app } = await testServer();
    const b = browser(app);
    for (let i = 0; i < 10; i++)
      await b.post("/auth/login", {
        email: ADMIN.email,
        password: "mauvais-mot-de-passe",
      });
    expect((await b.post("/auth/login", ADMIN)).status).toBe(429);
  });

  it("un corps illisible sur les réglages est une erreur de saisie, pas une panne", async () => {
    const { app } = await testServer();
    const admin = browser(app);
    await admin.post("/auth/login", ADMIN);
    const res = await app.request("/api/admin/settings/pedagogy", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
        cookie: admin.cookie(),
      },
      body: "{pas du json",
    });
    expect(res.status).toBe(422);
  });
});
