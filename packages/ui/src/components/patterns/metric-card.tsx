/**
 * Un chiffre qui compte, avec sa variation, sa comparaison, et une phrase honnête
 * quand la donnée n'existe pas encore.
 *
 * Source : ZeroAds `packages/ui/src/patterns/metric-card.tsx` et `figure.tsx` (code
 * d'Olivier ; l'idée « une phrase à la place d'un chiffre absent » y avait été étudiée
 * chez Midday, aucun code AGPL repris). Adapté à Wema : étiquette Geist Mono, chiffre
 * en Geist tabulaire, pastille `GlowTile`, arrondi `card`. Rendu possible côté serveur.
 *
 * Différence avec `StatTile` (components/wema) : `MetricCard` accepte `value = null`
 * et affiche alors une phrase, à la hauteur du chiffre, pour que la rangée ne bouge pas
 * (jamais de zéro ni de tiret pour une donnée inconnue), et porte une ligne de comparaison.
 *
 * Props :
 * - `label` : ce qui est compté ; `value` : nombre (formaté fr-FR avec `format`), texte déjà
 *   formaté, ou `null` (pas encore disponible) ; `unavailable` : la phrase (« Pas encore de
 *   données : il faut une première séance. »).
 * - `delta` : `{ value, format?, goodWhen? ("up" | "down") }` : la couleur suit le sens
 *   favorable, pas le signe ; aucune variation sans période précédente.
 * - `comparison` : la ligne de contexte (« contre 12 la semaine dernière »).
 * - `icon`, `tone` (ton `GlowTile`), `hint`, `action` (un lien), `size` (`default` | `lg`).
 * `MetricCardSkeleton` : la forme de la carte pendant le chargement.
 */
import {
  ArrowDownRightIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
} from "@phosphor-icons/react/ssr";
import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { GlowTile, type GlowTone } from "../brand/glow-tile";
import { Skeleton } from "../ui/skeleton";

export interface MetricDelta {
  readonly value: number;
  readonly format?: Intl.NumberFormatOptions | undefined;
  readonly goodWhen?: "up" | "down" | undefined;
}

export interface MetricCardProps {
  readonly label: ReactNode;
  readonly value: number | string | null;
  readonly format?: Intl.NumberFormatOptions | undefined;
  readonly unavailable?: ReactNode;
  readonly delta?: MetricDelta | undefined;
  readonly comparison?: ReactNode;
  readonly icon?: ReactNode;
  readonly tone?: GlowTone | undefined;
  readonly hint?: ReactNode;
  readonly action?: ReactNode;
  readonly size?: "default" | "lg" | undefined;
  readonly className?: string | undefined;
}

export function MetricCard({
  label,
  value,
  format,
  unavailable = "Pas encore de données.",
  delta,
  comparison,
  icon,
  tone = "yellow",
  hint,
  action,
  size = "default",
  className,
}: MetricCardProps) {
  const absent = value === null;
  const shown =
    typeof value === "number"
      ? new Intl.NumberFormat("fr-FR", format).format(value)
      : value;
  let deltaNode: ReactNode = null;
  if (delta && !absent) {
    const direction =
      delta.value > 0 ? "up" : delta.value < 0 ? "down" : "flat";
    const Icon =
      direction === "up"
        ? ArrowUpRightIcon
        : direction === "down"
          ? ArrowDownRightIcon
          : ArrowRightIcon;
    const good = direction !== "flat" && direction === (delta.goodWhen ?? "up");
    deltaNode = (
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-pill px-1.5 py-0.5 font-mono text-[11px] font-medium tabular-nums",
          direction === "flat" && "bg-muted text-muted-foreground",
          direction !== "flat" &&
            (good
              ? "bg-success-soft text-success-text"
              : "bg-danger-soft text-danger-text"),
        )}
      >
        <Icon aria-hidden weight="bold" className="size-3" />
        {new Intl.NumberFormat("fr-FR", {
          signDisplay: "exceptZero",
          ...delta.format,
        }).format(delta.value)}
      </span>
    );
  }
  return (
    <article
      className={cn(
        "flex flex-col gap-4 rounded-card border border-border bg-card p-5 shadow-xs transition-[border-color] duration-150 hover:border-line-strong motion-reduce:transition-none",
        className,
      )}
      data-slot="metric-card"
      data-unavailable={absent ? "" : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-mono text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
          {label}
        </h3>
        {icon ? (
          <GlowTile tone={tone} size={36} aria-hidden>
            {icon}
          </GlowTile>
        ) : null}
      </div>
      {/* Hauteur réservée : la phrase occupe la place du chiffre. */}
      <div
        className={cn(
          "flex items-end",
          size === "lg" ? "min-h-12" : "min-h-10",
        )}
      >
        {absent ? (
          <p className="text-[15px] text-pretty text-muted-foreground">
            {unavailable}
          </p>
        ) : (
          <p
            className={cn(
              "font-light leading-none tracking-tight text-foreground tabular-nums",
              size === "lg" ? "text-5xl" : "text-4xl",
            )}
          >
            {shown}
          </p>
        )}
      </div>
      {deltaNode || comparison ? (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {deltaNode}
          {comparison && !absent ? <span>{comparison}</span> : null}
        </p>
      ) : null}
      {hint ? (
        <p className="text-xs text-pretty text-muted-foreground">{hint}</p>
      ) : null}
      {action ? <div className="mt-auto text-xs">{action}</div> : null}
    </article>
  );
}

export function MetricCardSkeleton({
  className,
}: {
  readonly className?: string | undefined;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "flex flex-col gap-4 rounded-card border border-border bg-card p-5",
        className,
      )}
      data-slot="metric-card-skeleton"
    >
      <div className="flex items-start justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="size-9 rounded-[27%]" />
      </div>
      <Skeleton className="h-10 w-28" />
      <Skeleton className="h-4 w-40" />
    </div>
  );
}
