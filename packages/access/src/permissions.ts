import type { Membership, OrganizationId, Permission } from "@wema/domain";
import { PERMISSIONS, permissionScope } from "@wema/domain";

/**
 * Une permission est-elle effective pour cette organisation ?
 * - portée `platform` : seulement si elle est donnée dans l'organisation Wema ;
 * - portée `organization` : si elle est donnée dans cette organisation, ou
 *   dans l'organisation Wema (l'équipe Wema administre toutes les organisations).
 */
export function can(
  memberships: readonly Membership[],
  permission: Permission,
  organizationId?: OrganizationId,
): boolean {
  return memberships.some((m) => {
    if (!m.permissions.includes(permission)) return false;
    if (m.organizationKind === "platform") return true;
    if (permissionScope(permission) === "platform") return false;
    return organizationId === undefined || m.organizationId === organizationId;
  });
}

/** Permissions effectives dans une organisation, pour n'afficher que ce qui est autorisé. */
export function effectivePermissions(
  memberships: readonly Membership[],
  organizationId?: OrganizationId,
): Permission[] {
  return PERMISSIONS.map((p) => p.id).filter((p) =>
    can(memberships, p, organizationId),
  );
}
