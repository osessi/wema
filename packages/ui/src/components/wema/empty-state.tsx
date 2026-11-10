import type { ComponentProps, ReactNode } from "react";
import { cn } from "../../lib/utils";
import { GlowTile, type GlowTone } from "../brand/glow-tile";
import { type FigureName, Illustration } from "../illustrations/illustration";

export interface EmptyStateProps
  extends Omit<ComponentProps<"div">, "title" | "children"> {
  /** Glyphe Phosphor (élément), placé dans une pastille `GlowTile`. */
  icon?: ReactNode | undefined;
  tone?: GlowTone | undefined;
  /**
   * Figure Hairline (voir `ILLUSTRATION_FOR`), à la place de la pastille.
   * Décorative : le titre dit déjà ce qui manque.
   */
  illustration?: FigureName | undefined;
  title: ReactNode;
  /** Niveau du titre : `h2` ou `h3` selon la page (le `h1` reste unique). */
  titleAs?: "h2" | "h3" | "p" | undefined;
  description?: ReactNode | undefined;
  /** Bouton ou lien d'action. */
  action?: ReactNode | undefined;
  /**
   * `card` : cadre pointillé (page ou section vide) ; `inline` : sans cadre,
   * compact (liste vide dans une carte).
   */
  variant?: "card" | "inline" | undefined;
}

/**
 * État vide : pastille, titre, texte et action. Remplace les quatre formes
 * actuelles : `<p className="text-muted-foreground">`, sa variante
 * `text-sm`, l'`EmptyState` de l'admin et le bloc de `teacher/bank-board.tsx`.
 */
export function EmptyState({
  icon,
  tone = "slate",
  illustration,
  title,
  titleAs: Title = "h3",
  description,
  action,
  variant = "card",
  className,
  ...props
}: EmptyStateProps) {
  const inline = variant === "inline";
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex min-w-0 flex-col items-center text-center text-balance",
        inline
          ? "gap-3 px-2 py-6"
          : "gap-4 rounded-card border border-dashed bg-card/50 px-4 py-10 sm:px-8",
        className,
      )}
      {...props}
    >
      {illustration ? (
        <Illustration
          figure={illustration}
          className={cn(
            inline ? "w-36" : "w-48 sm:w-56",
            !inline &&
              "[--hairline-plate:color-mix(in_srgb,var(--card)_50%,var(--background))]",
          )}
        />
      ) : icon ? (
        <GlowTile tone={tone} size={inline ? 40 : 56}>
          {icon}
        </GlowTile>
      ) : null}
      <div className="flex max-w-sm flex-col gap-1.5">
        <Title
          className={cn(
            "font-semibold tracking-tight",
            inline ? "text-sm" : "text-base",
          )}
        >
          {title}
        </Title>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? (
        <div className="flex flex-wrap justify-center gap-2">{action}</div>
      ) : null}
    </div>
  );
}
