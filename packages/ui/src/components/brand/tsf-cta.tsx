import { Slot } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";

/** Flèche fine du site, révélée au survol des boutons biseautés. */
export function TsfArrow({ className }: { readonly className?: string }) {
  return (
    <svg
      viewBox="0 0 14 14"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path
        d="M1 7h11M7.5 2.5 12 7l-4.5 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export interface TsfCtaProps extends ComponentProps<"button"> {
  /** Rend l'enfant unique (un `Link`, un `a`) avec le style du bouton. */
  readonly asChild?: boolean | undefined;
  /** `ink` : encre (action courante) ; `brand` : jaune Wema (action phare, un seul par zone). */
  readonly tone?: "ink" | "brand" | undefined;
  /** `md` : 48 px ; `sm` : 36 px. */
  readonly size?: "sm" | "md" | undefined;
  /** Flèche révélée au survol et au focus. Vraie par défaut. */
  readonly arrow?: boolean | undefined;
}

/**
 * Bouton biseauté du site (coin bas-droit coupé, majuscules, remplissage qui
 * balaie au survol). Réservé à l'action principale d'un écran. Le focus
 * clavier dessine un contour biseauté à l'intérieur du bouton.
 */
export function TsfCta({
  asChild = false,
  tone = "ink",
  size = "md",
  arrow = true,
  className,
  children,
  type,
  ...props
}: TsfCtaProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="tsf-cta"
      data-tone={tone}
      data-size={size}
      className={cn("tk-cta", className)}
      type={asChild ? undefined : (type ?? "button")}
      {...props}
    >
      <Slot.Slottable>{children}</Slot.Slottable>
      {arrow ? <TsfArrow /> : null}
    </Comp>
  );
}
