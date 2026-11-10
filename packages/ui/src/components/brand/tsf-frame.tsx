import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

/** Losange jaune de 7 px (plein) ou cerné (`outline`). Décoratif. */
export function TsfDiamond({
  outline = false,
  className,
}: {
  readonly outline?: boolean | undefined;
  readonly className?: string | undefined;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn("tk-diamond", className)}
      data-outline={outline ? "" : undefined}
    />
  );
}

export interface TsfFrameProps extends HTMLAttributes<HTMLDivElement> {
  readonly children: ReactNode;
  /** Classes du panneau intérieur (fond, marges internes). */
  readonly innerClassName?: string | undefined;
  /** `surface` : carte claire (sombre en thème Nuit) ; `graphite` : panneau sombre dans les deux thèmes. */
  readonly tone?: "surface" | "graphite" | undefined;
  /** Repères en croix avec losange aux coins haut-droit et bas-gauche. */
  readonly marks?: boolean | undefined;
}

/**
 * Cadre biseauté du site (coins haut-gauche et bas-droit coupés à 16 px,
 * 12 px sur mobile), liseré intérieur et diagonales dessinées. Réservé aux
 * temps forts : carte héro d'un espace, carte de réussite.
 */
export function TsfFrame({
  children,
  className,
  innerClassName,
  tone = "surface",
  marks = true,
  ...props
}: TsfFrameProps) {
  return (
    <div {...props} className={cn("tk-frame", className)}>
      <div
        className={cn(
          "tk-frame-cut h-full overflow-hidden",
          tone === "graphite"
            ? "dark bg-[#151610] text-[#f5f6f0]"
            : "bg-surface text-foreground",
          innerClassName,
        )}
      >
        {children}
        <span aria-hidden="true" className="tk-frame-rim" />
      </div>
      {marks ? (
        <>
          <span aria-hidden="true" className="tk-frame-mark" data-at="tr">
            <TsfDiamond outline />
          </span>
          <span aria-hidden="true" className="tk-frame-mark" data-at="bl">
            <TsfDiamond outline />
          </span>
        </>
      ) : null}
    </div>
  );
}
