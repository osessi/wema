import type { OrganizationId, RoleId, UserId } from "./ids";

/**
 * Portée d'une permission :
 * - `organization` : agit dans l'organisation où le rôle est donné ;
 * - `platform` : agit sur tout Wema, et n'est effective que dans
 *   l'organisation de plateforme (fiche de décision 0004).
 */
export type PermissionScope = "organization" | "platform";

/** Catalogue fermé des actions que le code sait vérifier. */
export const PERMISSIONS = [
  { id: "curriculum.read", scope: "organization" },
  { id: "curriculum.write", scope: "platform" },
  { id: "settings.pedagogy.manage", scope: "platform" },
  { id: "organizations.manage", scope: "platform" },
  { id: "roles.manage", scope: "organization" },
  { id: "members.manage", scope: "organization" },
  { id: "audit.read", scope: "organization" },
] as const satisfies readonly { id: string; scope: PermissionScope }[];

export type Permission = (typeof PERMISSIONS)[number]["id"];

const permissionIds: ReadonlySet<string> = new Set(
  PERMISSIONS.map((p) => p.id),
);

export function isPermission(value: string): value is Permission {
  return permissionIds.has(value);
}

export function permissionScope(permission: Permission): PermissionScope {
  return PERMISSIONS.find((p) => p.id === permission)?.scope ?? "platform";
}

/** École, réseau de profs, famille, ou Wema elle-même (unique). */
export type OrganizationKind = "platform" | "school" | "tutoring" | "family";

export interface Organization {
  id: OrganizationId;
  name: string;
  kind: OrganizationKind;
}

/** Ensemble de permissions, configurable, propre à une organisation. */
export interface Role {
  id: RoleId;
  organizationId: OrganizationId;
  name: string;
  permissions: readonly Permission[];
  /** Rôle système (Super admin) : ni supprimable, ni vidable. */
  system: boolean;
}

/** Lien utilisateur × organisation × rôle. */
export interface Membership {
  userId: UserId;
  organizationId: OrganizationId;
  organizationKind: OrganizationKind;
  roleId: RoleId;
  permissions: readonly Permission[];
}
