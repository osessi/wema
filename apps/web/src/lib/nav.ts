import type { Permission } from "@wema/domain";

/** Sections du back-office et la permission qui les rend visibles. */
export const SECTIONS: {
  key: "curriculum" | "subjects" | "organizations" | "settings" | "audit";
  href: string;
  permission: Permission;
}[] = [
  {
    key: "curriculum",
    href: "/admin/referentiel",
    permission: "curriculum.read",
  },
  { key: "subjects", href: "/admin/matieres", permission: "curriculum.read" },
  {
    key: "organizations",
    href: "/admin/organisations",
    permission: "members.manage",
  },
  {
    key: "settings",
    href: "/admin/reglages",
    permission: "settings.pedagogy.manage",
  },
  { key: "audit", href: "/admin/journal", permission: "audit.read" },
];
