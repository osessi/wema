import type { ComponentProps, ReactNode } from "react";
import { cn } from "../../lib/utils";

export interface ProgressRingProps
  extends Omit<ComponentProps<"div">, "children"> {
  /** Avancement, de 0 à `max`. */
  value: number;
  max?: number | undefined;
  /** Nom accessible de la barre (« Notions validées »). */
  label: string;
  /** Diamètre en pixels. */
  size?: number | undefined;
  /** Épaisseur du trait en pixels. */
  thickness?: number | undefined;
  /** Couleur du remplissage. `brand` = jaune de la marque. */
  tone?: "brand" | "ink" | "mint" | "peach" | undefined;
  /**
   * Contenu au centre. Par défaut, le pourcentage en `fr-FR`. `null` pour
   * un anneau nu.
   */
  children?: ReactNode | undefined;
  /** Texte annoncé à la place du pourcentage (« 12 notions sur 20 »). */
  valueText?: string | undefined;
}

const TONES = {
  brand: "stroke-brand",
  ink: "stroke-foreground",
  mint: "stroke-mint-ink",
  peach: "stroke-peach-ink",
} as const;

const percentFormat = new Intl.NumberFormat("fr-FR", {
  style: "percent",
  maximumFractionDigits: 0,
});

/**
 * Anneau de progression (inspiré de Magic UI `animated-circular-progress-bar`,
 * fait maison, sans dépendance). Le remplissage glisse d'une valeur à
 * l'autre, sauf si l'utilisateur réduit les animations.
 */
export function ProgressRing({
  value,
  max = 100,
  label,
  size = 72,
  thickness = 6,
  tone = "brand",
  children,
  valueText,
  className,
  style,
  ...props
}: ProgressRingProps) {
  const safeMax = max > 0 ? max : 1;
  const clamped = Math.min(Math.max(value, 0), safeMax);
  const ratio = clamped / safeMax;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const shown = percentFormat.format(ratio);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={clamped}
      aria-valuetext={valueText ?? shown}
      data-slot="progress-ring"
      className={cn(
        "relative inline-grid shrink-0 place-items-center",
        className,
      )}
      style={{ width: size, height: size, ...style }}
      {...props}
    >
      <svg
        aria-hidden
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={thickness}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          className={cn(
            TONES[tone],
            "transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none",
            ratio === 0 && "opacity-0",
          )}
        />
      </svg>
      {children !== null ? (
        <span
          aria-hidden
          className="absolute inset-0 grid place-items-center font-mono text-xs font-medium tabular-nums"
          style={{ fontSize: Math.max(10, Math.round(size / 5.5)) }}
        >
          {children ?? shown}
        </span>
      ) : null}
    </div>
  );
}
