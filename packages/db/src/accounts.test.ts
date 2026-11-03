import { PGlite } from "@electric-sql/pglite";
import { asRoleId, type UserId } from "@wema/domain";
import { beforeEach, describe, expect, it } from "vitest";
import {
  bootstrapPlatform,
  createAccountStore,
  createAuditLog,
  createOrganizationStore,
  fromPglite,
  migrate,
  type SqlExecutor,
} from "./index";

let db: SqlExecutor;
beforeEach(async () => {
  db = fromPglite(new PGlite());
  await migrate(db);
});

const admin = {
  displayName: "Admin Test",
  email: "admin@example.test",
  passwordHash: "scrypt$x",
};

describe("bootstrapPlatform", () => {
  it("crée Wema, le rôle Super admin et le premier super admin, une seule fois", async () => {
    const first = await bootstrapPlatform(db, { superAdmin: admin });
    const second = await bootstrapPlatform(db, {
      superAdmin: { ...admin, email: "autre@example.test" },
    });
    expect(first.createdSuperAdmin).toBe(true);
    expect(second.createdSuperAdmin).toBe(false);
    expect(second.platform.id).toBe(first.platform.id);
    const orgs = createOrganizationStore(db);
    expect(await orgs.countSuperAdmins()).toBe(1);
    const [role] = await orgs.listRoles(first.platform.id);
    expect(role?.system).toBe(true);
    expect(role?.permissions).toContain("curriculum.write");
  });
});

describe("bootstrapPlatform face à un compte pré-inscrit", () => {
  it("ne promeut jamais un compte existant qui porte l'e-mail prévu", async () => {
    const accounts = createAccountStore(db);
    const squatter = await accounts.createUser({
      displayName: "Inconnu",
      createdBy: null,
    });
    await accounts.addIdentity({
      userId: squatter.id,
      kind: "email",
      identifier: admin.email,
      secretHash: "scrypt$autre",
      verified: false,
    });
    const boot = await bootstrapPlatform(db, { superAdmin: admin });
    expect(boot).toMatchObject({
      createdSuperAdmin: false,
      superAdminEmailTaken: true,
    });
    expect(await createOrganizationStore(db).countSuperAdmins()).toBe(0);
  });
});

describe("rôles et appartenances", () => {
  async function setup() {
    const boot = await bootstrapPlatform(db, { superAdmin: admin });
    const accounts = createAccountStore(db);
    const orgs = createOrganizationStore(db);
    const identity = await accounts.findIdentity("email", admin.email);
    if (!identity) throw new Error("super admin absent");
    return { ...boot, accounts, orgs, adminId: identity.userId };
  }

  it("refuse de retirer le dernier super admin, accepte s'il en reste un autre", async () => {
    const { orgs, accounts, adminId, superAdminRoleId } = await setup();
    expect(
      await orgs.removeMembership({
        userId: adminId,
        roleId: superAdminRoleId,
      }),
    ).toEqual({
      ok: false,
      error: { kind: "last_super_admin" },
    });
    const other = await accounts.createUser({
      displayName: "Second admin",
      createdBy: adminId,
    });
    await orgs.addMembership({ userId: other.id, roleId: superAdminRoleId });
    expect(
      (
        await orgs.removeMembership({
          userId: adminId,
          roleId: superAdminRoleId,
        })
      ).ok,
    ).toBe(true);
    expect(await orgs.countSuperAdmins()).toBe(1);
  });

  it("le rôle système ne se renomme pas : un rôle homonyme ne devient jamais système", async () => {
    const { orgs, platform, superAdminRoleId } = await setup();
    const renamed = await orgs.updateRole(superAdminRoleId, {
      name: "Patron",
      permissions: [],
    });
    expect(renamed.ok && renamed.value.name).toBe("Super admin");
    await bootstrapPlatform(db, { superAdmin: admin });
    const roles = await orgs.listRoles(platform.id);
    expect(roles.filter((r) => r.system)).toHaveLength(1);
  });

  it("le rôle système garde toutes ses permissions et ne se supprime pas", async () => {
    const { orgs, superAdminRoleId } = await setup();
    const updated = await orgs.updateRole(superAdminRoleId, {
      name: "Super admin",
      permissions: [],
    });
    expect(updated.ok && updated.value.permissions.length).toBeGreaterThan(5);
    expect(await orgs.deleteRole(superAdminRoleId)).toEqual({
      ok: false,
      error: { kind: "system_role" },
    });
  });

  it("crée un rôle configurable, refuse un doublon et la suppression d'un rôle utilisé", async () => {
    const { orgs, accounts, adminId } = await setup();
    const school = await orgs.createOrganization({
      name: "École Exemple",
      kind: "school",
    });
    const role = await orgs.createRole({
      organizationId: school.id,
      name: "Ingénieur pédagogique",
      permissions: ["curriculum.read", "audit.read"],
    });
    if (!role.ok) throw new Error(role.error.kind);
    expect(
      await orgs.createRole({
        organizationId: school.id,
        name: "Ingénieur pédagogique",
        permissions: [],
      }),
    ).toEqual({ ok: false, error: { kind: "duplicate_role_name" } });

    const user = await accounts.createUser({
      displayName: "Prof Exemple",
      createdBy: adminId,
    });
    await orgs.addMembership({ userId: user.id, roleId: role.value.id });
    expect(await orgs.deleteRole(role.value.id)).toEqual({
      ok: false,
      error: { kind: "role_in_use" },
    });

    const memberships = await accounts.listMemberships(user.id);
    expect(memberships).toEqual([
      expect.objectContaining({
        organizationId: school.id,
        organizationKind: "school",
        permissions: ["curriculum.read", "audit.read"],
      }),
    ]);
    const members = await orgs.listMembers(school.id);
    expect(members.map((m) => m.displayName)).toEqual(["Prof Exemple"]);
  });

  it("refuse une appartenance à un rôle inconnu", async () => {
    const { orgs, adminId } = await setup();
    expect(
      await orgs.addMembership({
        userId: adminId,
        roleId: asRoleId("00000000-0000-4000-8000-000000000999"),
      }),
    ).toEqual({ ok: false, error: { kind: "role_not_found" } });
  });
});

describe("sessions et codes", () => {
  const now = new Date("2026-11-01T10:00:00Z");
  const day = 24 * 60 * 60 * 1000;

  async function user(): Promise<UserId> {
    return (
      await createAccountStore(db).createUser({
        displayName: "Élève Test",
        createdBy: null,
      })
    ).id;
  }

  it("une session valide renvoie l'utilisateur, une session expirée non", async () => {
    const accounts = createAccountStore(db);
    const id = await user();
    await accounts.createSession({
      tokenHash: "h1",
      userId: id,
      expiresAt: new Date(now.getTime() + day),
    });
    expect((await accounts.useSession("h1", now, day, 90 * day))?.id).toBe(id);
    expect(
      await accounts.useSession(
        "h1",
        new Date(now.getTime() + 3 * day),
        day,
        90 * day,
      ),
    ).toBeNull();
    expect(await accounts.useSession("inconnu", now, day, 90 * day)).toBeNull();
  });

  it("une session expire après sa durée de vie maximale, même utilisée chaque jour", async () => {
    const accounts = createAccountStore(db);
    const id = await user();
    await accounts.createSession({
      tokenHash: "h2",
      userId: id,
      expiresAt: new Date(Date.now() + day),
    });
    expect(
      await accounts.useSession("h2", new Date(), day, 90 * day),
    ).not.toBeNull();
    expect(await accounts.useSession("h2", new Date(), day, -1)).toBeNull();
    await accounts.deleteUserSessions(id);
    expect(
      await accounts.useSession("h2", new Date(), day, 90 * day),
    ).toBeNull();
  });

  it("un code ne se consomme qu'une fois", async () => {
    const accounts = createAccountStore(db);
    await accounts.createOneTimeCode({
      phone: "+33600000002",
      codeHash: "c",
      expiresAt: new Date(now.getTime() + day),
    });
    const code = await accounts.attemptLatestCode("+33600000002");
    if (!code) throw new Error("code absent");
    expect(await accounts.consumeCode(code.id, now)).toBe(true);
    expect(await accounts.consumeCode(code.id, now)).toBe(false);
  });

  it("un identifiant de connexion est unique", async () => {
    const accounts = createAccountStore(db);
    const a = await user();
    const b = await user();
    const input = {
      kind: "username" as const,
      identifier: "eleve.test",
      secretHash: "x",
      verified: true,
    };
    expect(await accounts.addIdentity({ ...input, userId: a })).not.toBeNull();
    expect(await accounts.addIdentity({ ...input, userId: b })).toBeNull();
  });

  it("chaque vérification de code compte une tentative", async () => {
    const accounts = createAccountStore(db);
    await accounts.createOneTimeCode({
      phone: "+33600000000",
      codeHash: "c",
      expiresAt: new Date(now.getTime() + day),
    });
    await accounts.attemptLatestCode("+33600000000");
    expect((await accounts.attemptLatestCode("+33600000000"))?.attempts).toBe(
      2,
    );
    expect(await accounts.countCodesSince("+33600000000", new Date(0))).toBe(1);
  });
});

describe("journal d'audit", () => {
  it("s'ajoute et se relit, mais ne se modifie pas", async () => {
    const audit = createAuditLog(db);
    await audit.append({
      actorId: null,
      organizationId: null,
      action: "notion.create",
      targetType: "notion",
      targetId: "n1",
      details: { code: "pythagore" },
    });
    const [entry] = await audit.list({ limit: 10 });
    expect(entry).toMatchObject({
      action: "notion.create",
      details: { code: "pythagore" },
    });
    await expect(db.exec("UPDATE audit_log SET action = 'x'")).rejects.toThrow(
      /ajout seul/,
    );
  });
});
