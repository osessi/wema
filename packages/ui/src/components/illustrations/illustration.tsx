"use client";

import {
  Basket,
  Drawer,
  Elevator,
  type HairlineProps,
  Laptop,
  Lockers,
  Loupe,
  Plug,
  Query,
  Router,
  Slow,
  Terrain,
} from "@lucasmarkes/hairline/react";
import type { ComponentType } from "react";
import { cn } from "../../lib/utils";
import { useReducedMotion } from "../brand/tsf-motion";

/**
 * Figures Hairline retenues pour Wema (sur les 33 du paquet), choisies sur
 * planche. On n'importe que celles-ci : une figure de plus s'ajoute ici.
 */
const FIGURES = {
  basket: Basket,
  drawer: Drawer,
  elevator: Elevator,
  laptop: Laptop,
  lockers: Lockers,
  loupe: Loupe,
  plug: Plug,
  query: Query,
  router: Router,
  slow: Slow,
  terrain: Terrain,
} satisfies Record<string, ComponentType<HairlineProps>>;

export type FigureName = keyof typeof FIGURES;

import { ILLUSTRATION_FOR } from "./usages";

export { ILLUSTRATION_FOR, type IllustrationUsage } from "./usages";

// Chaque usage doit nommer une figure importée ci-dessus.
ILLUSTRATION_FOR satisfies Record<string, FigureName>;

export interface IllustrationProps
  extends Omit<HairlineProps, "label" | "theme" | "aria-label"> {
  figure: FigureName;
  /**
   * Description lue par les lecteurs d'écran. Sans libellé, la figure est
   * décorative (`aria-hidden`) : c'est le cas courant, le texte est à côté.
   */
  label?: string | undefined;
}

/**
 * Figure isométrique en trait (Hairline) qui répond au pointeur, à l'encre
 * Wema dans les deux thèmes. Elle prend la largeur de son parent (5:4).
 * Le fond des plaques suit `--card` ; sur un autre fond, passer
 * `className="[--hairline-plate:var(--background)]"`. Si l'utilisateur réduit
 * les animations, c'est une image fixe : ni lecture seule, ni réponse au pointeur.
 */
export function Illustration({
  figure,
  label,
  play,
  className,
  ...props
}: IllustrationProps) {
  const reduced = useReducedMotion();
  const Figure = FIGURES[figure];
  return (
    <Figure
      {...props}
      data-slot="illustration"
      data-figure={figure}
      {...(label ? { label } : { "aria-hidden": true })}
      play={play === true && !reduced}
      className={cn(
        "[--hairline-plate:var(--card)] [--hairline-stroke:1]",
        "[--hairline-hi:var(--foreground)]",
        "[--hairline-edge:color-mix(in_srgb,var(--foreground)_58%,var(--hairline-plate))]",
        "[--hairline-mid:color-mix(in_srgb,var(--foreground)_30%,var(--hairline-plate))]",
        "[--hairline-lo:color-mix(in_srgb,var(--foreground)_14%,var(--hairline-plate))]",
        reduced && "pointer-events-none",
        className,
      )}
    />
  );
}
