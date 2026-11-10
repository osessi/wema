import {
  DEFAULT_PRIVACY_SETTINGS,
  loadPrivacySettings,
  runRetention,
} from "@wema/db";
import { describe, expect, it } from "vitest";
import { ADMIN, browser, field, testServer, text } from "./test-helpers";

const PASSWORD = "mot-de-passe-de-test-1";
const DAY = 24 * 60 * 60 * 1000;

/**
 * Collège (direction, une classe avec Élève Un) ; famille où Parent gère la
 * famille et compte Élève Un parmi ses membres (sans lien parent-enfant encore).
 */
async function setup() {
  const server = await testServer();
  const admin = browser(server.app);
  await admin.post("/auth/login", ADMIN);
  const org = async (name: string, kind: string) =>
    text((await admin.post("/admin/organizations", { name, kind })).json, "id");
  const role = async (orgId: string, name: string, permissions: string[]) =>
    text(
      (
        await admin.post(`/admin/organizations/${orgId}/roles`, {
          name,
          permissions,
        })
      ).json,
      "id",
    );
  const member = async (
    orgId: string,
    roleId: string,
    displayName: string,
    email: string,
    by = admin,
  ) =>
    text(
      (
        await by.post(`/admin/organizations/${orgId}/members`, {
          displayName,
          roleId,
          login: { kind: "email", email, password: PASSWORD },
        })
      ).json,
      "userId",
    );
  const login = async (email: string) => {
    const b = browser(server.app);
    await b.post("/auth/login", { email, password: PASSWORD });
    return b;
  };

  const school = await org("Collège", "school");
  const direction = await role(school, "Direction", [
    "classes.manage",
    "members.manage",
  ]);
  const pupilRole = await role(school, "Élève", []);
  await member(school, direction, "Direction", "direction@example.test");
  const dir = await login("direction@example.test");
  const pupil = await member(
    school,
    pupilRole,
    "Élève Un",
    "eleve1@example.test",
    dir,
  );
  const classId = text(
    (await dir.post(`/admin/organizations/${school}/classes`, { name: "4e A" }))
      .json,
    "id",
  );
  await dir.post(`/admin/classes/${classId}/members`, {
    userId: pupil,
    role: "learner",
  });

  const family = await org("Famille", "family");
  const parentRole = await role(family, "Parent", [
    "members.manage",
    "learners.read",
  ]);
  const childRole = await role(family, "Enfant", []);
  const parent = await member(
    family,
    parentRole,
    "Parent",
    "parent@example.test",
  );
  await member(family, childRole, "Élève Un", "eleve1@example.test");

  return {
    ...server,
    admin,
    dir,
    school,
    family,
    ids: { pupil, parent },
    parent: await login("parent@example.test"),
    pupil: await login("eleve1@example.test"),
    login,
  };
}

describe("inscription, conditions et âge", () => {
  it("refuse l'inscription seul d'un élève sous l'âge du consentement numérique", async () => {
    const { app } = await testServer();
    const b = browser(app);
    const res = await b.post("/auth/register", {
      displayName: "Jeune",
      email: "jeune@example.test",
      password: PASSWORD,
      birthYear: new Date().getUTCFullYear() - 12,
      acceptTerms: true,
    });
    expect(res.status).toBe(422);
    expect(field(res.json, "error", "code")).toBe("minor_needs_guardian");
  });

  it("enregistre les conditions acceptées ; un changement de version les redemande", async () => {
    const { app } = await testServer();
    const b = browser(app);
    const res = await b.post("/auth/register", {
      displayName: "Adulte",
      email: "adulte@example.test",
      password: PASSWORD,
      birthYear: 1990,
      acceptTerms: true,
    });
    expect(res.status).toBe(201);
    expect(field((await b.get("/auth/me")).json, "mustAcceptTerms")).toBe(
      false,
    );

    const admin = browser(app);
    await admin.post("/auth/login", ADMIN);
    // L'admin n'a jamais accepté : il doit le faire.
    expect(field((await admin.get("/auth/me")).json, "mustAcceptTerms")).toBe(
      true,
    );
    expect(
      (
        await admin.put("/admin/privacy/settings", {
          ...DEFAULT_PRIVACY_SETTINGS,
          deletionGraceDays: 0,
        })
      ).status,
    ).toBe(422);
    expect(
      (
        await admin.put("/admin/privacy/settings", {
          ...DEFAULT_PRIVACY_SETTINGS,
          termsVersion: "2027-01-01",
        })
      ).status,
    ).toBe(200);
    expect(field((await b.get("/auth/me")).json, "mustAcceptTerms")).toBe(true);
    const versions = (await b.get("/legal/versions")).json;
    expect(field(versions, "termsVersion")).toBe("2027-01-01");

    // Seule la version en vigueur s'accepte.
    const old = await b.post("/account/terms", {
      termsVersion: DEFAULT_PRIVACY_SETTINGS.termsVersion,
      privacyVersion: DEFAULT_PRIVACY_SETTINGS.privacyVersion,
    });
    expect(old.status).toBe(409);
    await b.post("/account/terms", versions);
    expect(field((await b.get("/auth/me")).json, "mustAcceptTerms")).toBe(
      false,
    );
  });

  it("réserve les réglages RGPD à l'équipe Wema", async () => {
    const { app } = await testServer();
    const b = browser(app);
    await b.post("/auth/register", {
      displayName: "Adulte",
      email: "adulte@example.test",
      password: PASSWORD,
    });
    expect((await b.get("/admin/privacy/settings")).status).toBe(403);
  });
});

describe("consentement parental", () => {
  it("signale à l'école l'élève sans consentement, jusqu'au lien fait par le parent", async () => {
    const s = await setup();
    const path = `/admin/privacy/organizations/${s.school}/missing-consents`;
    const before = await s.dir.get(path);
    expect(before.status).toBe(200);
    expect(JSON.stringify(before.json)).toContain(s.ids.pupil);
    // Une autre personne ne voit pas les signalements de l'école.
    expect((await s.parent.get(path)).status).toBe(403);

    await s.parent.post(`/admin/organizations/${s.family}/guardianships`, {
      guardianId: s.ids.parent,
      learnerId: s.ids.pupil,
    });
    expect(field((await s.dir.get(path)).json, "learners")).toEqual([]);

    const account = await s.parent.get("/account");
    const consents = field(account.json, "children");
    expect(JSON.stringify(consents)).toContain("guardian_link");
  });

  it("un lien créé par un tiers ne vaut pas consentement ; le parent le donne depuis son compte", async () => {
    const s = await setup();
    await s.admin.post(`/admin/organizations/${s.family}/guardianships`, {
      guardianId: s.ids.parent,
      learnerId: s.ids.pupil,
    });
    const path = `/admin/privacy/organizations/${s.school}/missing-consents`;
    expect(JSON.stringify((await s.dir.get(path)).json)).toContain(s.ids.pupil);
    expect(
      (await s.parent.post(`/account/children/${s.ids.pupil}/consent`, {}))
        .status,
    ).toBe(400);
    expect(
      (
        await s.parent.post(`/account/children/${s.ids.pupil}/consent`, {
          confirm: true,
        })
      ).status,
    ).toBe(201);
    expect(field((await s.dir.get(path)).json, "learners")).toEqual([]);
    // Pas pour l'enfant de quelqu'un d'autre.
    expect(
      (
        await s.dir.post(`/account/children/${s.ids.pupil}/consent`, {
          confirm: true,
        })
      ).status,
    ).toBe(404);
  });
});

describe("export et suppression", () => {
  it("exporte ses données en JSON téléchargeable, sans secret", async () => {
    const s = await setup();
    const res = await s.pupil.get("/account/export");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toContain("attachment");
    expect(field(res.json, "format")).toBe("wema-export");
    expect(JSON.stringify(field(res.json, "identities"))).toContain(
      "eleve1@example.test",
    );
    expect(JSON.stringify(res.json)).not.toContain("scrypt");
    expect(Array.isArray(field(res.json, "learningEvents"))).toBe(true);
    expect(Array.isArray(field(res.json, "healthDeclarations"))).toBe(true);
  });

  it("un parent exporte et fait supprimer le compte de son enfant ; l'enfant ne le peut pas seul", async () => {
    const s = await setup();
    // Sans lien, rien.
    expect(
      (await s.parent.get(`/account/children/${s.ids.pupil}/export`)).status,
    ).toBe(404);
    await s.parent.post(`/admin/organizations/${s.family}/guardianships`, {
      guardianId: s.ids.parent,
      learnerId: s.ids.pupil,
    });
    expect(
      (await s.parent.get(`/account/children/${s.ids.pupil}/export`)).status,
    ).toBe(200);

    const self = await s.pupil.post("/account/deletion", { confirm: true });
    expect(self.status).toBe(403);
    expect(field(self.json, "error", "code")).toBe("guardian_required");

    const asked = await s.parent.post(
      `/account/children/${s.ids.pupil}/deletion`,
      { confirm: true },
    );
    expect(asked.status).toBe(201);
    const pending = field((await s.pupil.get("/account")).json, "deletion");
    expect(field(pending, "reason")).toBe("guardian");
    expect(
      (await s.parent.delete(`/account/children/${s.ids.pupil}/deletion`))
        .status,
    ).toBe(200);
    expect(field((await s.pupil.get("/account")).json, "deletion")).toBeNull();
  });

  it("supprime son compte après le délai de grâce ; annulable avant", async () => {
    const s = await setup();
    const res = await s.dir.post("/account/deletion", { confirm: true });
    expect(res.status).toBe(201);
    const settings = await loadPrivacySettings(s.db);
    const scheduled = new Date(text(res.json, "deletion", "scheduledFor"));
    expect(scheduled.getTime() - Date.now()).toBeGreaterThan(
      (settings.deletionGraceDays - 1) * DAY,
    );

    // Avant l'échéance, le compte vit encore.
    await runRetention(s.db, settings, new Date());
    expect((await s.dir.get("/auth/me")).status).toBe(200);

    await runRetention(
      s.db,
      settings,
      new Date(Date.now() + (settings.deletionGraceDays + 1) * DAY),
    );
    expect((await s.dir.get("/auth/me")).status).toBe(401);
    const again = browser(s.app);
    const login = await again.post("/auth/login", {
      email: "direction@example.test",
      password: PASSWORD,
    });
    expect(login.status).toBe(401);
    // La trace d'audit ne garde que l'identifiant ; la ligne du compte est anonyme.
    const audit = await s.db.query<{ details: unknown }>(
      "SELECT details FROM audit_log WHERE action = 'account.purge'",
    );
    expect(audit.rows).toHaveLength(1);
    expect(JSON.stringify(audit.rows)).not.toContain("Direction");
    const left = await s.db.query<{ display_name: string }>(
      "SELECT display_name FROM users WHERE display_name = 'Direction'",
    );
    expect(left.rows).toHaveLength(0);
  });

  it("refuse de supprimer le dernier super admin", async () => {
    const s = await setup();
    const res = await s.admin.post("/account/deletion", { confirm: true });
    expect(res.status).toBe(409);
    expect(field(res.json, "error", "code")).toBe("last_super_admin");
  });
});
