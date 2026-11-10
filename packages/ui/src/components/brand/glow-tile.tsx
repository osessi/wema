import type { CSSProperties, HTMLAttributes, ReactNode, Ref } from "react";
import { cn } from "../../lib/utils";

/**
 * Tons des pastilles lumineuses. Palette chaude et neutre de Wema : pas de
 * bleu franc, de violet, d'indigo, de terracotta ni de vert lagune.
 */
export type GlowTone = "yellow" | "amber" | "mint" | "rose" | "sky" | "slate";
export type GlowIdle = "none" | "breathe" | "orbit" | "shimmer";

export const GLOW_TONE_NAMES: readonly GlowTone[] = [
  "yellow",
  "amber",
  "mint",
  "rose",
  "sky",
  "slate",
];

const tone = (name: GlowTone) => ({
  a: `var(--glow-${name}-a)`,
  b: `var(--glow-${name}-b)`,
  core: `var(--glow-${name}-core)`,
});

export const GLOW_TONES: Readonly<
  Record<
    GlowTone,
    { readonly a: string; readonly b: string; readonly core: string }
  >
> = {
  yellow: tone("yellow"),
  amber: tone("amber"),
  mint: tone("mint"),
  rose: tone("rose"),
  sky: tone("sky"),
  slate: tone("slate"),
};

/** Style avec propriétés personnalisées (--gi-*), sans conversion de type. */
type GlowStyle = CSSProperties & Record<`--${string}`, string>;

export interface GlowTileProps
  extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  /** Ton de la pastille. */
  readonly tone: GlowTone;
  /** Côté en pixels (24 dans un menu, 40 à 48 dans une carte, 56 à 72 en vedette). */
  readonly size: number;
  /** Part du glyphe dans la pastille (« 50% » par défaut, « 64% » à 24 px). */
  readonly glyph?: string | undefined;
  /** Animation au repos, coupée si l'utilisateur réduit les animations. */
  readonly idle?: GlowIdle | undefined;
  /** Allume le halo (entrée active, survol piloté de l'extérieur). */
  readonly lit?: boolean | undefined;
  readonly ref?: Ref<HTMLSpanElement> | undefined;
  readonly children: ReactNode;
}

/**
 * Pastille lumineuse du site : cœur sombre, halo coloré, liseré de verre et
 * glyphe blanc. Décorative : toujours `aria-hidden`, le libellé est ailleurs.
 */
export function GlowTile({
  tone,
  size,
  glyph,
  idle = "none",
  lit = false,
  className,
  style,
  ref,
  children,
  ...props
}: GlowTileProps) {
  const t = GLOW_TONES[tone];
  const vars: GlowStyle = {
    "--gi-a": t.a,
    "--gi-b": t.b,
    "--gi-core": t.core,
    "--gi-size": `${size}px`,
    ...(glyph === undefined ? {} : { "--gi-glyph": glyph }),
    ...style,
  };
  return (
    <span
      ref={ref}
      aria-hidden="true"
      data-slot="glow-tile"
      data-tone={tone}
      data-lit={lit ? "" : undefined}
      {...props}
      className={cn("gi shrink-0", idle !== "none" && `gi-${idle}`, className)}
      style={vars}
    >
      <span className="gi-glow" />
      <span className="gi-rim" />
      <span className="gi-glyph">{children}</span>
    </span>
  );
}
