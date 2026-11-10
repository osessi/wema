"use client";

import { TsfEyebrow } from "@wema/ui/brand";
import { createContext, use } from "react";

/** Ce que la coquille sait de la page : l'espace courant. */
export const ShellContext = createContext<{ spaceLabel: string } | null>(null);

/**
 * Sur-titre par défaut d'un en-tête de page : le nom de l'espace (« Élève »,
 * « Prof »…). Rien hors d'un espace (compte, pages publiques).
 */
export function ShellEyebrow({ className }: { className?: string }) {
  const shell = use(ShellContext);
  if (!shell || shell.spaceLabel === "") return null;
  return (
    <TsfEyebrow
      phrases={[shell.spaceLabel]}
      dots={false}
      rule={false}
      className={className}
    />
  );
}
