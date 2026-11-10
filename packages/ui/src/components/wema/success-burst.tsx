"use client";

import { type ComponentProps, type ReactNode, useEffect, useRef } from "react";
import { cn } from "../../lib/utils";

export interface SuccessBurstProps
  extends Omit<ComponentProps<"div">, "title" | "children"> {
  /** Titre annoncé (zone `status`) : la réussite est toujours dite en texte. */
  title: ReactNode;
  description?: ReactNode | undefined;
  /** Actions (continuer, revenir…). */
  action?: ReactNode | undefined;
  /** Confettis sobres autour de la coche. */
  confetti?: boolean | undefined;
  /** Change la valeur pour rejouer l'animation. */
  playKey?: string | number | undefined;
  /** Taille de la coche en pixels. */
  size?: number | undefined;
}

/** Couleurs de la charte : jaune, encre, menthe, pêche. */
const CONFETTI_COLORS = [
  "var(--brand)",
  "var(--foreground)",
  "var(--mint-ink)",
  "var(--peach-ink)",
  "var(--brand)",
];
const PIECES = 18;

const reducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Réussite : une coche qui se dessine (courbe `za-draw` du site) dans une
 * pastille, et quelques confettis aux couleurs de la charte. Fait maison
 * (pas de `canvas-confetti`) avec l'API Web Animations : rien ne bouge si
 * l'utilisateur réduit les animations, et les confettis sont `aria-hidden`.
 */
export function SuccessBurst({
  title,
  description,
  action,
  confetti = true,
  playKey,
  size = 72,
  className,
  ...props
}: SuccessBurstProps) {
  const checkRef = useRef<SVGPathElement>(null);
  const ringRef = useRef<HTMLSpanElement>(null);
  const confettiRef = useRef<HTMLSpanElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `playKey` rejoue l'animation
  useEffect(() => {
    if (reducedMotion()) return;
    const animations: Animation[] = [];
    const check = checkRef.current;
    if (check) {
      const length = check.getTotalLength();
      check.style.strokeDasharray = `${length}`;
      animations.push(
        check.animate([{ strokeDashoffset: length }, { strokeDashoffset: 0 }], {
          duration: 520,
          delay: 160,
          easing: "cubic-bezier(0.65, 0, 0.35, 1)",
          fill: "both",
        }),
      );
    }
    if (ringRef.current)
      animations.push(
        ringRef.current.animate(
          [
            { transform: "scale(0.6)", opacity: 0 },
            { transform: "scale(1.06)", opacity: 1, offset: 0.7 },
            { transform: "scale(1)", opacity: 1 },
          ],
          { duration: 420, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
        ),
      );
    const pieces = confettiRef.current?.children ?? [];
    for (let i = 0; i < pieces.length; i++) {
      const piece = pieces[i];
      if (!(piece instanceof HTMLElement)) continue;
      const angle = (i / pieces.length) * Math.PI * 2 + (i % 3) * 0.2;
      const distance = size * (0.75 + ((i * 37) % 10) / 20);
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance;
      animations.push(
        piece.animate(
          [
            { transform: "translate(-50%, -50%) scale(0.4)", opacity: 0 },
            {
              transform: `translate(calc(-50% + ${x * 0.7}px), calc(-50% + ${y * 0.7}px)) rotate(${i * 40}deg) scale(1)`,
              opacity: 1,
              offset: 0.45,
            },
            {
              transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y + 18}px)) rotate(${i * 80}deg) scale(0.9)`,
              opacity: 0,
            },
          ],
          {
            duration: 1100,
            delay: 260 + (i % 4) * 30,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
            fill: "both",
          },
        ),
      );
    }
    return () => {
      for (const a of animations) a.cancel();
    };
  }, [playKey, size]);

  return (
    <div
      data-slot="success-burst"
      className={cn("flex flex-col items-center gap-4 text-center", className)}
      {...props}
    >
      <span
        className="relative grid place-items-center"
        style={{ width: size, height: size }}
      >
        {confetti ? (
          <span
            ref={confettiRef}
            aria-hidden
            className="pointer-events-none absolute inset-0 motion-reduce:hidden"
          >
            {Array.from({ length: PIECES }, (_, i) => (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: confettis décoratifs, liste figée
                key={i}
                className="absolute top-1/2 left-1/2 opacity-0"
                style={{
                  width: i % 3 === 0 ? 6 : 4,
                  height: i % 3 === 0 ? 6 : 9,
                  borderRadius: i % 2 === 0 ? 999 : 1.5,
                  background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                }}
              />
            ))}
          </span>
        ) : null}
        <span
          ref={ringRef}
          aria-hidden
          className="relative grid size-full place-items-center rounded-full bg-mint text-mint-ink shadow-[0_0_0_6px_color-mix(in_oklab,var(--mint)_45%,transparent)]"
        >
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            fill="none"
            width={size * 0.5}
            height={size * 0.5}
          >
            <path
              ref={checkRef}
              d="M5 12.5l4.2 4.2L19 7"
              stroke="currentColor"
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </span>
      <div role="status" className="space-y-1">
        <p className="text-lg font-semibold">{title}</p>
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
