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
  { id: "exercises.read", scope: "organization" },
  { id: "exercises.write", scope: "organization" },
  { id: "ai.manage", scope: "platform" },
  { id: "contacts.manage", scope: "platform" },
  /** Conseiller Wema : publie ses disponibilités et mène les diagnostics. */
  { id: "diagnostic.conduct", scope: "platform" },
  { id: "learners.read", scope: "organization" },
  { id: "learners.write", scope: "organization" },
  { id: "learners.health.read", scope: "organization" },
  { id: "learners.health.write", scope: "organization" },
  { id: "classes.manage", scope: "organization" },
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

/** Modèle de rôle créé avec une organisation (modifiable ensuite comme tout rôle). */
export interface RoleTemplate {
  name: string;
  permissions: readonly Permission[];
  /**
   * Rôle de l'apprenant de l'organisation (enfant, élève) : celui qu'on donne
   * à un compte élève créé depuis le parcours famille.
   */
  learner: boolean;
}

const LEARNER_PERMISSIONS = [
  "curriculum.read",
] as const satisfies readonly Permission[];

/** Direction d'école ou responsable d'un réseau de profs. */
const MANAGER_PERMISSIONS = [
  "curriculum.read",
  "members.manage",
  "roles.manage",
  "classes.manage",
  "exercises.read",
  "exercises.write",
  "learners.read",
  "learners.write",
  "learners.health.read",
  "audit.read",
] as const satisfies readonly Permission[];

const TEACHER_PERMISSIONS = [
  "curriculum.read",
  "exercises.read",
  "exercises.write",
  "learners.read",
  "learners.write",
] as const satisfies readonly Permission[];

/**
 * Rôles créés avec chaque organisation, selon son type (données, identiques
 * pour tous les pays). Une famille : le parent gère la famille, lit et déclare
 * pour ses enfants (besoins de santé avec son consentement, fiche 0006) ; une
 * école ou un réseau de profs : direction (ou responsable), prof, élève.
 */
export const DEFAULT_ROLES: Readonly<
  Record<Exclude<OrganizationKind, "platform">, readonly RoleTemplate[]>
> = {
  family: [
    {
      name: "Parent",
      permissions: [
        "curriculum.read",
        "members.manage",
        "learners.read",
        "learners.write",
        "learners.health.read",
        "learners.health.write",
      ],
      learner: false,
    },
    { name: "Enfant", permissions: LEARNER_PERMISSIONS, learner: true },
  ],
  school: [
    { name: "Direction", permissions: MANAGER_PERMISSIONS, learner: false },
    { name: "Prof", permissions: TEACHER_PERMISSIONS, learner: false },
    { name: "Élève", permissions: LEARNER_PERMISSIONS, learner: true },
  ],
  tutoring: [
    { name: "Responsable", permissions: MANAGER_PERMISSIONS, learner: false },
    { name: "Prof", permissions: TEACHER_PERMISSIONS, learner: false },
    { name: "Élève", permissions: LEARNER_PERMISSIONS, learner: true },
  ],
};
