import {
  Atom,
  BookOpen,
  BookOpenText,
  Books,
  Brain,
  ChartLineUp,
  Cpu,
  Dna,
  Flask,
  GlobeHemisphereWest,
  GlobeSimple,
  MathOperations,
  Microscope,
  MusicNotes,
  Palette,
  Scroll,
  SoccerBall,
  Translate,
} from "@phosphor-icons/react/dist/ssr";
import type { ComponentType, ReactNode } from "react";
import { cn } from "../../lib/utils";
import { GlowTile, type GlowTone } from "../brand/glow-tile";

type Glyph = ComponentType<{
  weight?: "bold";
  className?: string;
}>;

/**
 * Dessin et ton de chaque icône de matière. Les clés sont la liste fermée
 * `SUBJECT_ICONS` de `@wema/domain` (vérifiée à la frontière de l'API) : la
 * matière choisit sa clé dans le référentiel, jamais par son code ici.
 */
export const SUBJECT_ICON_GLYPHS = {
  math: { glyph: MathOperations, tone: "yellow" },
  french: { glyph: BookOpenText, tone: "rose" },
  language: { glyph: Translate, tone: "sky" },
  science: { glyph: Microscope, tone: "mint" },
  physics: { glyph: Atom, tone: "sky" },
  chemistry: { glyph: Flask, tone: "mint" },
  biology: { glyph: Dna, tone: "mint" },
  history: { glyph: Scroll, tone: "amber" },
  geography: { glyph: GlobeHemisphereWest, tone: "sky" },
  philosophy: { glyph: Brain, tone: "rose" },
  economics: { glyph: ChartLineUp, tone: "amber" },
  computer: { glyph: Cpu, tone: "slate" },
  art: { glyph: Palette, tone: "rose" },
  music: { glyph: MusicNotes, tone: "yellow" },
  sport: { glyph: SoccerBall, tone: "mint" },
  book: { glyph: Books, tone: "amber" },
  globe: { glyph: GlobeSimple, tone: "sky" },
} as const satisfies Record<string, { glyph: Glyph; tone: GlowTone }>;

export type SubjectIconName = keyof typeof SUBJECT_ICON_GLYPHS;

/** Les clés dessinées, dans l'ordre de la grille de choix. */
export const SUBJECT_ICON_NAMES = Object.keys(SUBJECT_ICON_GLYPHS).filter(
  (k): k is SubjectIconName => k in SUBJECT_ICON_GLYPHS,
);

const GENERIC: { glyph: Glyph; tone: GlowTone } = {
  glyph: BookOpen,
  tone: "slate",
};

const GLYPHS: ReadonlyMap<string, { glyph: Glyph; tone: GlowTone }> = new Map(
  Object.entries(SUBJECT_ICON_GLYPHS),
);

const lookup = (icon: string | null | undefined) =>
  (icon == null ? undefined : GLYPHS.get(icon)) ?? GENERIC;

export interface SubjectIconProps {
  /** Clé d'icône de la matière ; inconnue ou absente : livre générique. */
  readonly icon: string | null | undefined;
  /** Côté en pixels (24 dans une liste, 36 à 40 dans une carte). */
  readonly size?: number | undefined;
  readonly lit?: boolean | undefined;
  readonly className?: string | undefined;
}

/** Pastille lumineuse d'une matière, au ton de son icône. Décorative. */
export function SubjectIcon({
  icon,
  size = 32,
  lit,
  className,
}: SubjectIconProps) {
  const { glyph: Glyph, tone } = lookup(icon);
  return (
    <GlowTile
      tone={tone}
      size={size}
      glyph={size <= 28 ? "62%" : undefined}
      lit={lit}
      className={className}
      data-icon={icon ?? "generic"}
    >
      <Glyph weight="bold" />
    </GlowTile>
  );
}

/** Nom de matière précédé de son icône (listes, choix, cartes). */
export function SubjectLabel({
  icon,
  size = 24,
  className,
  children,
}: {
  readonly icon: string | null | undefined;
  readonly size?: number | undefined;
  readonly className?: string | undefined;
  readonly children: ReactNode;
}) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <SubjectIcon icon={icon} size={size} />
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}
