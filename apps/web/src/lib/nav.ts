import type { Permission } from "@wema/domain";

type SectionKey =
  | "curriculum"
  | "subjects"
  | "organizations"
  | "settings"
  | "ai"
  | "audit"
  | "billing"
  | "collective"
  | "costs";

/** Sections du back-office. */
export const SECTIONS: { key: SectionKey; href: string }[] = [
  { key: "curriculum", href: "/admin/referentiel" },
  { key: "subjects", href: "/admin/matieres" },
  { key: "organizations", href: "/admin/organisations" },
  { key: "settings", href: "/admin/reglages" },
  { key: "ai", href: "/admin/ia" },
  { key: "audit", href: "/admin/journal" },
  { key: "billing", href: "/admin/offres" },
  { key: "collective", href: "/admin/collectif" },
  { key: "costs", href: "/admin/couts" },
];

interface SessionPermissions {
  /** Permissions au niveau de la plateforme (rôles dans Wema). */
  permissions: readonly Permission[];
  organizations: readonly { permissions: readonly Permission[] }[];
}

/**
 * Sections visibles : le référentiel se consulte depuis n'importe quelle
 * organisation, les organisations se gèrent depuis la sienne, les réglages
 * et le journal complet sont réservés à l'équipe Wema.
 */
export function visibleSections(session: SessionPermissions) {
  const platform = new Set(session.permissions);
  const anywhere = new Set([
    ...platform,
    ...session.organizations.flatMap((o) => o.permissions),
  ]);
  const rules: Record<SectionKey, boolean> = {
    curriculum: anywhere.has("curriculum.read"),
    subjects: anywhere.has("curriculum.read"),
    organizations:
      anywhere.has("members.manage") || anywhere.has("roles.manage"),
    settings: platform.has("settings.pedagogy.manage"),
    ai: platform.has("ai.manage"),
    audit: platform.has("audit.read"),
    // Offres, abonnements et contrats : l'équipe Wema qui gère les organisations.
    billing: platform.has("organizations.manage"),
    // Agrégats anonymisés sur tous les élèves : l'équipe pédagogique de Wema.
    collective: platform.has("settings.pedagogy.manage"),
    costs: platform.has("ai.manage"),
  };
  return SECTIONS.filter((s) => rules[s.key]);
}
