import { randomUUID } from "node:crypto";
import type {
  Organization,
  OrganizationId,
  OrganizationKind,
  Permission,
  Result,
  Role,
  RoleId,
  UserId,
} from "@wema/domain";
import {
  asOrganizationId,
  asRoleId,
  asUserId,
  DEFAULT_ROLES,
  err,
  isPermission,
  ok,
  PERMISSIONS,
} from "@wema/domain";
import type { SqlExecutor } from "./executor";

export const SUPER_ADMIN_ROLE = "Super admin";

export type RoleError =
  | { kind: "role_not_found" }
  | { kind: "system_role" }
  | { kind: "duplicate_role_name" }
  | { kind: "role_in_use" };

export type MembershipError =
  | { kind: "role_not_found" }
  | { kind: "user_not_found" }
  | { kind: "last_super_admin" };

export interface Member {
  userId: UserId;
  displayName: string;
  disabled: boolean;
  roles: { id: RoleId; name: string }[];
  /** Moyens de connexion (sans les secrets). */
  identities: { kind: string; identifier: string }[];
}

interface OrganizationRow {
  id: string;
  name: string;
  kind: OrganizationKind;
}

interface RoleRow {
  id: string;
  organization_id: string;
  name: string;
  permissions: string[];
  system: boolean;
}

const toOrganization = (r: OrganizationRow): Organization => ({
  id: asOrganizationId(r.id),
  name: r.name,
  kind: r.kind,
});

const toRole = (r: RoleRow): Role => ({
  id: asRoleId(r.id),
  organizationId: asOrganizationId(r.organization_id),
  name: r.name,
  permissions: r.permissions.filter(isPermission),
  system: r.system,
});

const ROLE_COLUMNS = "id, organization_id, name, permissions, system";

function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" && e !== null && "code" in e && e.code === "23505"
  );
}

/**
 * Ce qu'une organisation voit des moyens de connexion de ses membres : le
 * numéro de téléphone est masqué, l'identifiant Google ou Apple n'est pas
 * montré (un même compte peut appartenir à plusieurs organisations).
 */
function maskIdentity(i: { kind: string; identifier: string }): {
  kind: string;
  identifier: string;
} {
  if (i.kind === "phone")
    return { kind: i.kind, identifier: `…${i.identifier.slice(-2)}` };
  if (i.kind === "google" || i.kind === "apple")
    return { kind: i.kind, identifier: "" };
  return i;
}

export function createOrganizationStore(db: SqlExecutor) {
  const countSuperAdmins = async (tx: SqlExecutor): Promise<number> => {
    const { rows } = await tx.query<{ n: number }>(
      `SELECT count(DISTINCT m.user_id)::int AS n
       FROM memberships m JOIN roles r ON r.id = m.role_id JOIN users u ON u.id = m.user_id
       JOIN organizations o ON o.id = r.organization_id
       WHERE r.system AND o.kind = 'platform' AND u.disabled_at IS NULL`,
    );
    return rows[0]?.n ?? 0;
  };

  const getRole = async (tx: SqlExecutor, id: RoleId): Promise<Role | null> => {
    const { rows } = await tx.query<RoleRow>(
      `SELECT ${ROLE_COLUMNS} FROM roles WHERE id = $1`,
      [id],
    );
    return rows[0] ? toRole(rows[0]) : null;
  };

  return {
    async listOrganizations(): Promise<Organization[]> {
      const { rows } = await db.query<OrganizationRow>(
        "SELECT id, name, kind FROM organizations ORDER BY kind = 'platform' DESC, name",
      );
      return rows.map(toOrganization);
    },

    async getOrganization(id: OrganizationId): Promise<Organization | null> {
      const { rows } = await db.query<OrganizationRow>(
        "SELECT id, name, kind FROM organizations WHERE id = $1",
        [id],
      );
      return rows[0] ? toOrganization(rows[0]) : null;
    },

    async getPlatformOrganization(): Promise<Organization | null> {
      const { rows } = await db.query<OrganizationRow>(
        "SELECT id, name, kind FROM organizations WHERE kind = 'platform'",
      );
      return rows[0] ? toOrganization(rows[0]) : null;
    },

    /**
     * Crée une organisation ; avec `defaultRoles`, crée aussi les rôles par
     * défaut de son type (`DEFAULT_ROLES`), dans la même transaction.
     */
    async createOrganization(input: {
      name: string;
      kind: Exclude<OrganizationKind, "platform">;
      defaultRoles?: boolean;
    }) {
      return db.transaction(async (tx) => {
        const { rows } = await tx.query<OrganizationRow>(
          "INSERT INTO organizations (id, name, kind) VALUES ($1, $2, $3) RETURNING id, name, kind",
          [randomUUID(), input.name, input.kind],
        );
        const row = rows[0];
        if (!row) throw new Error("création d'organisation sans retour");
        if (input.defaultRoles)
          for (const template of DEFAULT_ROLES[input.kind])
            await tx.query(
              "INSERT INTO roles (id, organization_id, name, permissions) VALUES ($1, $2, $3, $4)",
              [randomUUID(), row.id, template.name, [...template.permissions]],
            );
        return toOrganization(row);
      });
    },

    async listRoles(organizationId: OrganizationId): Promise<Role[]> {
      const { rows } = await db.query<RoleRow>(
        `SELECT ${ROLE_COLUMNS} FROM roles WHERE organization_id = $1 ORDER BY system DESC, name`,
        [organizationId],
      );
      return rows.map(toRole);
    },

    getRole: (id: RoleId) => getRole(db, id),

    async createRole(input: {
      organizationId: OrganizationId;
      name: string;
      permissions: readonly Permission[];
    }): Promise<Result<Role, RoleError>> {
      try {
        const { rows } = await db.query<RoleRow>(
          `INSERT INTO roles (id, organization_id, name, permissions) VALUES ($1, $2, $3, $4)
           RETURNING ${ROLE_COLUMNS}`,
          [
            randomUUID(),
            input.organizationId,
            input.name,
            [...new Set(input.permissions)],
          ],
        );
        const row = rows[0];
        if (!row) throw new Error("création de rôle sans retour");
        return ok(toRole(row));
      } catch (e) {
        if (isUniqueViolation(e)) return err({ kind: "duplicate_role_name" });
        throw e;
      }
    },

    /** Le rôle système garde son nom et toutes ses permissions. */
    async updateRole(
      id: RoleId,
      input: { name: string; permissions: readonly Permission[] },
    ): Promise<Result<Role, RoleError>> {
      const role = await getRole(db, id);
      if (!role) return err({ kind: "role_not_found" });
      const permissions = role.system
        ? PERMISSIONS.map((p) => p.id)
        : [...new Set(input.permissions)];
      const name = role.system ? role.name : input.name;
      try {
        const { rows } = await db.query<RoleRow>(
          `UPDATE roles SET name = $2, permissions = $3 WHERE id = $1 RETURNING ${ROLE_COLUMNS}`,
          [id, name, permissions],
        );
        const row = rows[0];
        return row ? ok(toRole(row)) : err({ kind: "role_not_found" });
      } catch (e) {
        if (isUniqueViolation(e)) return err({ kind: "duplicate_role_name" });
        throw e;
      }
    },

    async deleteRole(id: RoleId): Promise<Result<void, RoleError>> {
      return db.transaction(async (tx) => {
        const role = await getRole(tx, id);
        if (!role) return err({ kind: "role_not_found" });
        if (role.system) return err({ kind: "system_role" });
        const used = await tx.query(
          "SELECT 1 FROM memberships WHERE role_id = $1 LIMIT 1",
          [id],
        );
        if (used.rows.length > 0) return err({ kind: "role_in_use" });
        await tx.query("DELETE FROM roles WHERE id = $1", [id]);
        return ok(undefined);
      });
    },

    async isMember(
      organizationId: OrganizationId,
      userId: UserId,
    ): Promise<boolean> {
      const { rows } = await db.query(
        "SELECT 1 FROM memberships WHERE organization_id = $1 AND user_id = $2 LIMIT 1",
        [organizationId, userId],
      );
      return rows.length > 0;
    },

    async listMembers(organizationId: OrganizationId): Promise<Member[]> {
      const { rows } = await db.query<{
        user_id: string;
        display_name: string;
        disabled_at: Date | null;
        roles: { id: string; name: string }[];
        identities: { kind: string; identifier: string }[] | null;
      }>(
        `SELECT u.id AS user_id, u.display_name, u.disabled_at,
           json_agg(DISTINCT jsonb_build_object('id', r.id, 'name', r.name)) AS roles,
           (SELECT json_agg(jsonb_build_object('kind', i.kind, 'identifier', i.identifier) ORDER BY i.created_at)
              FROM identities i WHERE i.user_id = u.id) AS identities
         FROM memberships m
         JOIN users u ON u.id = m.user_id
         JOIN roles r ON r.id = m.role_id
         WHERE m.organization_id = $1
         GROUP BY u.id
         ORDER BY u.display_name`,
        [organizationId],
      );
      return rows.map((r) => ({
        userId: asUserId(r.user_id),
        displayName: r.display_name,
        disabled: r.disabled_at !== null,
        roles: r.roles.map((x) => ({ id: asRoleId(x.id), name: x.name })),
        identities: (r.identities ?? []).map(maskIdentity),
      }));
    },

    async addMembership(input: {
      userId: UserId;
      roleId: RoleId;
    }): Promise<Result<void, MembershipError>> {
      const role = await getRole(db, input.roleId);
      if (!role) return err({ kind: "role_not_found" });
      const user = await db.query("SELECT 1 FROM users WHERE id = $1", [
        input.userId,
      ]);
      if (user.rows.length === 0) return err({ kind: "user_not_found" });
      await db.query(
        `INSERT INTO memberships (user_id, organization_id, role_id) VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [input.userId, role.organizationId, role.id],
      );
      return ok(undefined);
    },

    /** Refuse de retirer le dernier super admin actif. */
    async removeMembership(input: {
      userId: UserId;
      roleId: RoleId;
    }): Promise<Result<void, MembershipError>> {
      return db.transaction(async (tx) => {
        // Sérialise les retraits concurrents de super admins.
        await tx.query(
          "SELECT pg_advisory_xact_lock(hashtext('wema_super_admins'))",
        );
        const role = await getRole(tx, input.roleId);
        if (!role) return err({ kind: "role_not_found" });
        if (role.system) {
          const holds = await tx.query(
            "SELECT 1 FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.user_id = $1 AND m.role_id = $2 AND u.disabled_at IS NULL",
            [input.userId, input.roleId],
          );
          if (holds.rows.length > 0 && (await countSuperAdmins(tx)) <= 1) {
            return err({ kind: "last_super_admin" });
          }
        }
        await tx.query(
          "DELETE FROM memberships WHERE user_id = $1 AND role_id = $2",
          [input.userId, input.roleId],
        );
        return ok(undefined);
      });
    },

    countSuperAdmins: () => countSuperAdmins(db),
  };
}

export type OrganizationStore = ReturnType<typeof createOrganizationStore>;
