import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
} from "@phosphor-icons/react/dist/ssr";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../../lib/utils";
import { GlowTile, type GlowTone } from "../brand/glow-tile";
import { Sparkline } from "../charts/sparkline";

export interface StatDelta {
  /** Variation (signée) : +3, -0,12… */
  value: number;
  /** Format de la variation (`{ style: "percent" }`, unité…). */
  format?: Intl.NumberFormatOptions | undefined;
  /** Sens favorable : la couleur suit le sens, pas le signe. */
  goodWhen?: "up" | "down" | undefined;
  /** Contexte (« depuis la semaine dernière »). */
  label?: string | undefined;
}

export interface StatTileProps extends Omit<ComponentProps<"div">, "children"> {
  /** Étiquette mono (« Notions validées »). */
  label: ReactNode;
  /** Un nombre est formaté en `fr-FR` (avec `format`) ; sinon affiché tel quel. */
  value: number | ReactNode;
  format?: Intl.NumberFormatOptions | undefined;
  /** Texte d'appoint sous la valeur. */
  hint?: ReactNode | undefined;
  delta?: StatDelta | undefined;
  /** Glyphe Phosphor (élément) dans une pastille `GlowTile` de 40 px. */
  icon?: ReactNode | undefined;
  tone?: GlowTone | undefined;
  /** Petite courbe (valeurs dans l'ordre du temps). Décorative. */
  trend?: number[] | undefined;
}

/**
 * Tuile de chiffre clé : étiquette mono, valeur en Geist léger et chiffres
 * tabulaires, variation, pastille et petite courbe facultatives. Généralise
 * le `Stat` de `school/stat.tsx` aux autres espaces.
 */
export function StatTile({
  label,
  value,
  format,
  hint,
  delta,
  icon,
  tone = "yellow",
  trend,
  className,
  ...props
}: StatTileProps) {
  const shown =
    typeof value === "number"
      ? new Intl.NumberFormat("fr-FR", format).format(value)
      : value;
  let deltaNode: ReactNode = null;
  if (delta) {
    const direction =
      delta.value > 0 ? "up" : delta.value < 0 ? "down" : "flat";
    const good = delta.goodWhen ?? "up";
    const Icon =
      direction === "up"
        ? ArrowUpRight
        : direction === "down"
          ? ArrowDownRight
          : ArrowRight;
    const text = new Intl.NumberFormat("fr-FR", {
      signDisplay: "exceptZero",
      ...delta.format,
    }).format(delta.value);
    deltaNode = (
      <p className="flex flex-wrap items-center gap-x-1.5 text-xs">
        <span
          className={cn(
            "inline-flex items-center gap-0.5 rounded-pill px-1.5 py-0.5 font-medium tabular-nums",
            direction === "flat" && "bg-muted text-muted-foreground",
            direction !== "flat" &&
              (direction === good
                ? "bg-success-soft text-success-text"
                : "bg-danger-soft text-danger-text"),
          )}
        >
          <Icon aria-hidden weight="bold" className="size-3" />
          {text}
        </span>
        {delta.label ? (
          <span className="text-muted-foreground">{delta.label}</span>
        ) : null}
      </p>
    );
  }
  return (
    <div
      data-slot="stat-tile"
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-card border bg-card p-4 text-card-foreground shadow-xs",
        className,
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 font-mono text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
          {label}
        </p>
        {icon ? (
          <GlowTile tone={tone} size={40}>
            {icon}
          </GlowTile>
        ) : null}
      </div>
      <div className="flex items-end justify-between gap-3">
        <p className="min-w-0 truncate text-3xl font-light tracking-tight tabular-nums">
          {shown}
        </p>
        {trend && trend.length > 1 ? (
          <Sparkline values={trend} tone={tone} />
        ) : null}
      </div>
      {deltaNode}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** Alias : « KPI » dans le rapport d'audit. */
export const Kpi = StatTile;
export type KpiProps = StatTileProps;
