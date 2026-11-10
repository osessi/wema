import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "../../lib/utils";
import type { GlowTone } from "../brand/glow-tile";

/*
 * Carte « double épaisseur » (comme le cadre de la vidéo du site) : une coque
 * teintée (20 px d'arrondi, liseré doux, 7 px de marge) qui porte la carte
 * intérieure (12 px d'arrondi, sa propre bordure, ombre douce).
 *
 * - `tone` teinte la coque : `neutral` (papier, par défaut), `brand`, `mint`,
 *   `sky`, `amber`, `rose`.
 * - `variant="flat"` retire la coque (carte dans une carte, liste dense) ;
 *   `variant="muted"` donne une surface atténuée, sans coque ni ombre, pour
 *   les blocs secondaires posés dans une carte ou sur le fond.
 *
 * `className` et les autres props vont à la carte intérieure, comme avant :
 * les enfants (`CardHeader`, `CardContent`…) y restent. Les classes de
 * placement (`h-full`, `min-w-0`, `col-span-*`…) sont recopiées sur la coque
 * pour que la carte garde sa place dans une grille ; `shellClassName` complète.
 */

export type CardTone = "neutral" | "brand" | "mint" | "sky" | "amber" | "rose";

export const CARD_TONES: readonly CardTone[] = [
  "neutral",
  "brand",
  "mint",
  "sky",
  "amber",
  "rose",
];

/** Teinte de coque assortie au ton d'une pastille `GlowTile`. */
export const SHELL_TONE_FOR_GLOW: Readonly<Record<GlowTone, CardTone>> = {
  yellow: "brand",
  amber: "amber",
  mint: "mint",
  rose: "rose",
  sky: "sky",
  slate: "neutral",
};

const cardShellVariants = cva(
  "relative flex min-w-0 flex-col rounded-[20px] border p-[7px] bg-linear-to-b shadow-[inset_0_1px_0_rgb(255_255_255/0.55),0_14px_32px_-26px_rgb(23_23_20/0.45)] dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.04),0_14px_32px_-24px_rgb(0_0_0/0.9)] *:data-[slot=card]:flex-1",
  {
    variants: {
      tone: {
        neutral:
          "border-foreground/[0.09] from-[color-mix(in_srgb,var(--foreground)_2.5%,var(--background))] to-[color-mix(in_srgb,var(--foreground)_5%,var(--background))]",
        brand:
          "border-[color-mix(in_srgb,var(--brand)_42%,var(--background))] from-[color-mix(in_srgb,var(--brand)_10%,var(--background))] to-[color-mix(in_srgb,var(--brand)_18%,var(--background))] dark:border-[color-mix(in_srgb,var(--brand)_24%,var(--background))] dark:from-[color-mix(in_srgb,var(--brand)_6%,var(--background))] dark:to-[color-mix(in_srgb,var(--brand)_11%,var(--background))]",
        mint: "border-[color-mix(in_srgb,var(--glow-mint-a)_30%,var(--background))] from-[color-mix(in_srgb,var(--glow-mint-a)_7%,var(--background))] to-[color-mix(in_srgb,var(--glow-mint-a)_13%,var(--background))] dark:border-[color-mix(in_srgb,var(--glow-mint-a)_22%,var(--background))] dark:from-[color-mix(in_srgb,var(--glow-mint-a)_5%,var(--background))] dark:to-[color-mix(in_srgb,var(--glow-mint-a)_9%,var(--background))]",
        sky: "border-[color-mix(in_srgb,var(--glow-sky-a)_30%,var(--background))] from-[color-mix(in_srgb,var(--glow-sky-a)_7%,var(--background))] to-[color-mix(in_srgb,var(--glow-sky-a)_13%,var(--background))] dark:border-[color-mix(in_srgb,var(--glow-sky-a)_22%,var(--background))] dark:from-[color-mix(in_srgb,var(--glow-sky-a)_5%,var(--background))] dark:to-[color-mix(in_srgb,var(--glow-sky-a)_9%,var(--background))]",
        amber:
          "border-[color-mix(in_srgb,var(--glow-amber-a)_32%,var(--background))] from-[color-mix(in_srgb,var(--glow-amber-a)_7%,var(--background))] to-[color-mix(in_srgb,var(--glow-amber-a)_13%,var(--background))] dark:border-[color-mix(in_srgb,var(--glow-amber-a)_22%,var(--background))] dark:from-[color-mix(in_srgb,var(--glow-amber-a)_5%,var(--background))] dark:to-[color-mix(in_srgb,var(--glow-amber-a)_9%,var(--background))]",
        rose: "border-[color-mix(in_srgb,var(--glow-rose-a)_28%,var(--background))] from-[color-mix(in_srgb,var(--glow-rose-a)_6%,var(--background))] to-[color-mix(in_srgb,var(--glow-rose-a)_11%,var(--background))] dark:border-[color-mix(in_srgb,var(--glow-rose-a)_22%,var(--background))] dark:from-[color-mix(in_srgb,var(--glow-rose-a)_5%,var(--background))] dark:to-[color-mix(in_srgb,var(--glow-rose-a)_9%,var(--background))]",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

/** Surface intérieure d'une carte posée dans une coque. */
const CARD_INNER_SHADOW =
  "shadow-[0_1px_2px_rgb(23_23_20/0.05),0_6px_16px_-10px_rgb(23_23_20/0.18)] dark:shadow-[0_1px_2px_rgb(0_0_0/0.5),0_8px_20px_-12px_rgb(0_0_0/0.8)]";

const cardVariants = cva(
  "flex flex-col gap-6 rounded-card border py-6 text-card-foreground",
  {
    variants: {
      variant: {
        default: `border-border bg-card ${CARD_INNER_SHADOW}`,
        flat: "border-border bg-card shadow-xs",
        muted: "border-border/70 bg-muted shadow-none",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

/*
 * Classes de placement à recopier sur la coque : celles qui décident de la
 * place de la carte dans son parent (grille, flex, ancre de défilement).
 */
const LAYOUT_CLASS =
  /^(?:[\w-]+:)*(?:h-full|h-auto|min-h-\S+|min-w-0|w-full|max-w-\S+|mx-auto|col-span-\S+|row-span-\S+|col-start-\S+|row-start-\S+|self-\S+|flex-1|grow|shrink-0|basis-\S+|order-\S+|scroll-mt-\S+|break-inside-avoid|opacity-\S+)$/;

/** Classes de placement de `className`, à poser aussi sur la coque. */
export function shellLayoutClasses(className: string | undefined): string {
  if (!className) return "";
  return className
    .split(/\s+/)
    .filter((c) => LAYOUT_CLASS.test(c))
    .join(" ");
}

interface CardShellProps extends React.ComponentProps<"div"> {
  readonly tone?: CardTone | undefined;
}

/**
 * Coque seule (la double épaisseur), pour envelopper une surface qui n'est pas
 * une `Card` : tuile de chiffre, groupe de champs, carte de classe…
 * L'enfant direct porte sa propre surface (`bg-card`, bordure, `rounded-card`).
 */
function CardShell({ tone, className, ...props }: CardShellProps) {
  return (
    <div
      data-slot="card-shell"
      data-tone={tone ?? "neutral"}
      className={cn(cardShellVariants({ tone }), className)}
      {...props}
    />
  );
}

interface CardProps
  extends React.ComponentProps<"div">,
    VariantProps<typeof cardVariants> {
  /** Teinte de la coque (sans effet avec `variant="flat"` ou `"muted"`). */
  readonly tone?: CardTone | undefined;
  /** Classes supplémentaires de la coque. */
  readonly shellClassName?: string | undefined;
}

function Card({
  className,
  variant = "default",
  tone,
  shellClassName,
  ...props
}: CardProps) {
  const inner = (
    <div
      data-slot="card"
      data-variant={variant}
      className={cn(cardVariants({ variant }), className)}
      {...props}
    />
  );
  if (variant !== "default") return inner;
  return (
    <CardShell
      tone={tone}
      className={cn(shellLayoutClasses(className ?? undefined), shellClassName)}
    >
      {inner}
    </CardShell>
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("leading-snug font-semibold tracking-tight", className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className,
      )}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-6", className)}
      {...props}
    />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-6 [.border-t]:pt-6", className)}
      {...props}
    />
  );
}

export {
  CARD_INNER_SHADOW,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardShell,
  CardTitle,
  cardShellVariants,
  cardVariants,
};
