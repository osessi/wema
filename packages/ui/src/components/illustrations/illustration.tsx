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

/** Usage Wema → figure. Changer d'image pour un usage se fait ici, et seulement ici. */
export const ILLUSTRATION_FOR = {
  /** Aucun devoir : un classeur dont le tiroir s'ouvre sur du vide. */
  emptyHomework: "drawer",
  /** Aucun message : un routeur aux antennes qui cherchent le signal. */
  emptyMessages: "router",
  /** Aucune classe : une rangée de casiers d'école. */
  emptyClasses: "lockers",
  /** Aucun exercice : un panier vide qui montre son fond. */
  emptyExercises: "basket",
  /** Bienvenue : un ordinateur dont l'écran s'ouvre. */
  welcome: "laptop",
  /** Test de niveau : un ascenseur à quatre étages, qui monte au niveau visé. */
  levelTest: "elevator",
  /** Diagnostic : une loupe posée sur une feuille. */
  diagnostic: "loupe",
  /** Chargement : des caisses sur un tapis roulant. */
  loading: "slow",
  /** Erreur : une prise débranchée qui n'atteint pas la prise murale. */
  error: "plug",
  /** Page introuvable : un point d'interrogation. */
  notFound: "query",
  /** Réussite : des piliers qui s'élèvent. */
  success: "terrain",
} as const satisfies Record<string, FigureName>;

export type IllustrationUsage = keyof typeof ILLUSTRATION_FOR;

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
