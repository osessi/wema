import { randomUUID } from "node:crypto";
import type { Organization, RoleId } from "@wema/domain";
import { asRoleId, PERMISSIONS } from "@wema/domain";
import { createAccountStore } from "./accounts";
import type { SqlExecutor } from "./executor";
import { createOrganizationStore, SUPER_ADMIN_ROLE } from "./organizations";

export interface BootstrapInput {
  /** Premier super admin, créé seulement s'il n'y en a aucun. */
  superAdmin: {
    displayName: string;
    email: string;
    passwordHash: string;
  } | null;
}

/**
 * Prépare la plateforme au démarrage : organisation Wema, rôle système
 * « Super admin » (toujours avec tout le catalogue de permissions, y compris
 * les permissions ajoutées depuis), et premier super admin si aucun n'existe.
 */
export async function bootstrapPlatform(
  db: SqlExecutor,
  input: BootstrapInput,
): Promise<{
  platform: Organization;
  superAdminRoleId: RoleId;
  createdSuperAdmin: boolean;
}> {
  return db.transaction(async (tx) => {
    await tx.query("SELECT pg_advisory_xact_lock(hashtext('wema_bootstrap'))");
    const organizations = createOrganizationStore(tx);
    await tx.query(
      "INSERT INTO organizations (id, name, kind) VALUES ($1, 'Wema', 'platform') ON CONFLICT DO NOTHING",
      [randomUUID()],
    );
    const platform = await organizations.getPlatformOrganization();
    if (!platform)
      throw new Error("organisation de plateforme introuvable après création");

    const allPermissions = PERMISSIONS.map((p) => p.id);
    const { rows } = await tx.query<{ id: string }>(
      `INSERT INTO roles (id, organization_id, name, permissions, system) VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (organization_id, name) DO UPDATE SET permissions = EXCLUDED.permissions, system = true
       RETURNING id`,
      [randomUUID(), platform.id, SUPER_ADMIN_ROLE, allPermissions],
    );
    const roleId = rows[0]?.id;
    if (!roleId) throw new Error("rôle Super admin introuvable après création");
    const superAdminRoleId = asRoleId(roleId);

    let createdSuperAdmin = false;
    if (input.superAdmin && (await organizations.countSuperAdmins()) === 0) {
      const accounts = createAccountStore(tx);
      const existing = await accounts.findIdentity(
        "email",
        input.superAdmin.email,
      );
      const userId =
        existing?.userId ??
        (
          await accounts.createUser({
            displayName: input.superAdmin.displayName,
            createdBy: null,
          })
        ).id;
      if (!existing) {
        await accounts.addIdentity({
          userId,
          kind: "email",
          identifier: input.superAdmin.email,
          secretHash: input.superAdmin.passwordHash,
          verified: true,
        });
      }
      await organizations.addMembership({ userId, roleId: superAdminRoleId });
      createdSuperAdmin = true;
    }
    return { platform, superAdminRoleId, createdSuperAdmin };
  });
}
