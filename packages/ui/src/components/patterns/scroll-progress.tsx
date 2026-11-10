"use client";

/**
 * Où en est la lecture d'une page longue (fiche de cours, rapport de progression).
 *
 * Source : ZeroAds `packages/ui/src/patterns/scroll-progress.tsx` (code d'Olivier), lui-même
 * repris d'iconiq `scroll-progress` (MIT) : deux piles de graduations, celle du dessus
 * rognée à la progression, mise à jour par références sans re-rendu. Adapté à Wema :
 * pourcentage en Geist Mono ; ajout de la variante `bar`, un trait jaune en haut de page.
 * Aucune animation propre : la progression suit le défilement de l'utilisateur.
 *
 * Props :
 * - `variant` : `ticks` (règle graduée sur le côté, défaut) ou `bar` (trait en haut).
 * - `position` (`ticks`) : `left` | `right` | `bottom-left` | `bottom-right`.
 * - `tickCount` (40), `height` (160), `width` (14), `showLabel` (vrai).
 * - `container` : référence d'un élément qui défile à la place de la fenêtre.
 * Décoratif (`aria-hidden`).
 */
import { type RefObject, useEffect, useRef } from "react";
import { cn } from "../../lib/utils";

export type ScrollProgressPosition =
  | "left"
  | "right"
  | "bottom-left"
  | "bottom-right";

const POSITION: Record<ScrollProgressPosition, string> = {
  left: "left-2 top-1/2 -translate-y-1/2",
  right: "right-2 top-1/2 -translate-y-1/2",
  "bottom-left": "left-2 bottom-2",
  "bottom-right": "right-2 bottom-2",
};

export function scrollPercent(
  top: number,
  scrollHeight: number,
  clientHeight: number,
): number {
  const scrollable = scrollHeight - clientHeight;
  if (scrollable <= 0) return 0;
  return Math.min(100, Math.max(0, (top / scrollable) * 100));
}

function progressOf(el: HTMLElement | null): number {
  if (el) return scrollPercent(el.scrollTop, el.scrollHeight, el.clientHeight);
  const doc = document.documentElement;
  return scrollPercent(window.scrollY, doc.scrollHeight, doc.clientHeight);
}

function Ticks({ count, solid }: { count: number; solid: boolean }) {
  return (
    <div className="flex h-full flex-col justify-between">
      {Array.from({ length: count }, (_, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: graduations décoratives
          key={i}
          className={cn(
            "block h-px w-full",
            solid ? "bg-foreground" : "bg-foreground/20",
          )}
        />
      ))}
    </div>
  );
}

export interface ScrollProgressProps {
  readonly variant?: "ticks" | "bar" | undefined;
  readonly position?: ScrollProgressPosition | undefined;
  readonly tickCount?: number | undefined;
  readonly height?: number | undefined;
  readonly width?: number | undefined;
  readonly showLabel?: boolean | undefined;
  readonly container?: RefObject<HTMLElement | null> | undefined;
  readonly className?: string | undefined;
}

export function ScrollProgress({
  variant = "ticks",
  position = "right",
  tickCount = 40,
  height = 160,
  width = 14,
  showLabel = true,
  container,
  className,
}: ScrollProgressProps) {
  const fillRef = useRef<HTMLDivElement>(null);
  const labelWrapRef = useRef<HTMLDivElement>(null);
  const labelTextRef = useRef<HTMLSpanElement>(null);
  const labelLeft = position === "right" || position === "bottom-right";

  useEffect(() => {
    const target: HTMLElement | Window = container?.current ?? window;
    const update = () => {
      const pct = progressOf(container?.current ?? null);
      if (fillRef.current) {
        if (variant === "bar")
          fillRef.current.style.transform = `scaleX(${pct / 100})`;
        else fillRef.current.style.height = `${pct}%`;
      }
      if (labelWrapRef.current) labelWrapRef.current.style.top = `${pct}%`;
      if (labelTextRef.current)
        labelTextRef.current.textContent = String(Math.round(pct));
    };
    update();
    target.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    return () => {
      target.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [container, variant]);

  if (variant === "bar") {
    return (
      <div
        aria-hidden
        className={cn(
          "pointer-events-none inset-x-0 top-0 z-50 h-0.5",
          container ? "absolute" : "fixed",
          className,
        )}
        data-slot="scroll-progress"
        data-variant="bar"
      >
        <div
          ref={fillRef}
          className="h-full origin-left bg-brand"
          style={{ transform: "scaleX(0)" }}
        />
      </div>
    );
  }

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none z-50 select-none",
        container ? "absolute" : "fixed",
        POSITION[position],
        className,
      )}
      data-slot="scroll-progress"
      data-position={position}
    >
      <div className="relative" style={{ height, width }}>
        <Ticks count={tickCount} solid={false} />
        <div
          ref={fillRef}
          className="absolute inset-x-0 top-0 overflow-hidden"
          style={{ height: "0%" }}
        >
          <div style={{ height, width: "100%" }}>
            <Ticks count={tickCount} solid />
          </div>
        </div>
        {showLabel ? (
          <div
            ref={labelWrapRef}
            className={cn(
              "absolute flex -translate-y-1/2 items-center gap-1",
              labelLeft
                ? "right-full flex-row-reverse pr-1.5"
                : "left-full pl-1.5",
            )}
            style={{ top: "0%" }}
          >
            <span className="h-px w-2 bg-brand" />
            <span
              ref={labelTextRef}
              className="font-mono text-[11px] font-medium text-foreground tabular-nums"
            >
              0
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
