"use client";

/**
 * Contrôle segmenté : quelques choix sur une ligne, le choix retenu en jaune
 * qui glisse d'un segment à l'autre (immobile si l'utilisateur réduit les animations).
 *
 * Source : ZeroAds `apps/web/src/components/onboarding/segmented.tsx` (code d'Olivier),
 * adapté à Wema : jaune #FFC529 et encre sur jaune, arrondis `control`, Geist.
 * De vrais boutons radio : les flèches changent le choix, le groupe est nommé.
 *
 * Props :
 * - `name` : nom du groupe radio (formulaire) ; `legend` : intitulé visible du groupe
 *   (`hideLegend` le garde pour les lecteurs d'écran seulement).
 * - `options` : `{ value, label, hint?, icon? }[]` ; `value`, `onValueChange`.
 * - `size` : `sm` | `md` (défaut) ; `disabled`.
 */
import { motion, useReducedMotion } from "motion/react";
import { type ReactNode, useId } from "react";
import { cn } from "../../lib/utils";

export interface SegmentedOption<T extends string> {
  readonly value: T;
  readonly label: ReactNode;
  readonly hint?: ReactNode;
  /** Glyphe Phosphor décoratif. */
  readonly icon?: ReactNode;
}

export interface SegmentedProps<T extends string> {
  readonly name: string;
  readonly legend: ReactNode;
  readonly hideLegend?: boolean | undefined;
  readonly options: readonly SegmentedOption<T>[];
  readonly value: T;
  readonly onValueChange: (value: T) => void;
  readonly size?: "sm" | "md" | undefined;
  readonly disabled?: boolean | undefined;
  readonly className?: string | undefined;
}

export function Segmented<T extends string>({
  name,
  legend,
  hideLegend = false,
  options,
  value,
  onValueChange,
  size = "md",
  disabled = false,
  className,
}: SegmentedProps<T>) {
  const glide = useId();
  const still = useReducedMotion() ?? false;
  return (
    <fieldset
      className={cn("grid min-w-0 gap-2", className)}
      disabled={disabled}
      data-slot="segmented"
    >
      <legend
        className={cn(
          "mb-2 text-sm font-medium text-foreground",
          hideLegend && "sr-only",
        )}
      >
        {legend}
      </legend>
      <div
        className={cn(
          "grid w-full items-stretch gap-0.5 rounded-menu border border-border bg-muted p-[3px]",
          disabled && "opacity-50",
        )}
        style={{
          gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
        }}
      >
        {options.map((option) => {
          const checked = value === option.value;
          return (
            <label
              key={option.value}
              className={cn(
                "group relative flex cursor-pointer flex-col items-center justify-center rounded-control px-2 text-center transition-colors duration-150 has-focus-visible:ring-2 has-focus-visible:ring-ring motion-reduce:transition-none",
                size === "sm" ? "min-h-7 py-0.5" : "min-h-9 py-1",
                !checked && "hover:bg-card/70",
              )}
            >
              {checked ? (
                <motion.span
                  layoutId={glide}
                  aria-hidden
                  className="absolute inset-0 rounded-control bg-brand shadow-xs"
                  transition={
                    still
                      ? { duration: 0 }
                      : { type: "spring", stiffness: 520, damping: 40 }
                  }
                />
              ) : null}
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => onValueChange(option.value)}
                className="sr-only"
              />
              <span
                className={cn(
                  "relative inline-flex items-center gap-1.5 font-medium [&_svg]:size-4",
                  size === "sm" ? "text-xs" : "text-[13px]",
                  checked
                    ? "font-semibold text-ink-on-brand"
                    : "text-muted-foreground group-hover:text-foreground",
                )}
              >
                {option.icon ? (
                  <span aria-hidden className="flex">
                    {option.icon}
                  </span>
                ) : null}
                {option.label}
              </span>
              {option.hint ? (
                <span
                  className={cn(
                    "relative text-[11px]",
                    checked ? "text-ink-on-brand/80" : "text-muted-foreground",
                  )}
                >
                  {option.hint}
                </span>
              ) : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
