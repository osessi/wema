import {
  ChalkboardTeacher,
  Crown,
  ShieldCheck,
  Student,
  UsersThree,
} from "@phosphor-icons/react/ssr";
import type { GlowTone } from "@wema/ui/components/brand/glow-tile";
import type { ReactNode } from "react";
import type { SchoolRoles } from "../../lib/school-types";

export type RoleTone = "brand" | "info" | "success" | "warning" | "neutral";

const GLOW: Record<RoleTone, GlowTone> = {
  brand: "yellow",
  info: "sky",
  success: "mint",
  warning: "amber",
  neutral: "slate",
};

const ICON: Record<RoleTone, ReactNode> = {
  brand: <Crown weight="fill" />,
  info: <ChalkboardTeacher weight="fill" />,
  success: <Student weight="fill" />,
  warning: <UsersThree weight="fill" />,
  neutral: <ShieldCheck weight="fill" />,
};

/**
 * Couleur d'un rôle : Direction en jaune, Prof en bleu, Élève en vert,
 * Parent en ambre. Les rôles créés par l'école se repèrent à leurs droits.
 */
export function roleTone(name: string, roles: SchoolRoles): RoleTone {
  const n = name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  if (/direct|admin|propri/.test(n)) return "brand";
  if (/prof|enseign/.test(n)) return "info";
  if (/eleve|enfant/.test(n)) return "success";
  if (/parent|tuteur/.test(n)) return "warning";
  const role = roles.find((r) => r.name === name);
  if (!role) return "neutral";
  const has = (p: string) => role.permissions.some((x) => x === p);
  if (role.system || has("members.manage")) return "brand";
  if (has("exercises.write")) return "info";
  return "neutral";
}

/** Pastille et glyphe d'un rôle (cartes de choix, en-têtes de la matrice). */
export function roleLook(name: string, roles: SchoolRoles) {
  const tone = roleTone(name, roles);
  return { tone, glow: GLOW[tone], icon: ICON[tone] };
}
