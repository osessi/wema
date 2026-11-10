/**
 * Squelettes composés : la forme d'une carte, d'une ligne de tableau, d'une liste ou
 * d'un graphique pendant que les données arrivent (la page ne saute pas à l'arrivée).
 *
 * Source : écrit pour Wema sur le `Skeleton` de `ui/skeleton` (pulsation coupée si
 * l'utilisateur réduit les animations), d'après les squelettes de ZeroAds
 * (`MetricCardSkeleton`, `StageLoading`, code d'Olivier).
 *
 * Chaque squelette est décoratif (`aria-hidden`). Le conteneur `SkeletonGroup` annonce
 * une seule fois le chargement aux lecteurs d'écran (`label`, « Chargement… »).
 *
 * Props :
 * - `SkeletonGroup` : `label`, `children`, `className`.
 * - `CardSkeleton` : `lines` (3), `media` (bandeau d'image en haut).
 * - `TableRowSkeleton` : `columns` (4), `rows` (5) ; à poser dans un `<tbody>`.
 * - `ListSkeleton` : `rows` (4), `avatar` (vrai).
 * - `ChartSkeleton` : `bars` (12), `height` (px, 180).
 */
import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { Skeleton } from "../ui/skeleton";

const WIDTHS = ["w-11/12", "w-3/4", "w-5/6", "w-2/3", "w-4/5"];
const HEIGHTS = [38, 62, 48, 80, 56, 70, 44, 90, 66, 52, 76, 60];

export function SkeletonGroup({
  label = "Chargement…",
  children,
  className,
}: {
  readonly label?: string | undefined;
  readonly children: ReactNode;
  readonly className?: string | undefined;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      className={className}
      data-slot="skeleton-group"
    >
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

export function CardSkeleton({
  lines = 3,
  media = false,
  className,
}: {
  readonly lines?: number | undefined;
  readonly media?: boolean | undefined;
  readonly className?: string | undefined;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "grid gap-3 rounded-card border border-border bg-card p-5",
        className,
      )}
      data-slot="card-skeleton"
    >
      {media ? <Skeleton className="h-32 w-full rounded-menu" /> : null}
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-5 w-2/3" />
      {Array.from({ length: lines }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: lignes positionnelles
        <Skeleton key={i} className={cn("h-3.5", WIDTHS[i % WIDTHS.length])} />
      ))}
    </div>
  );
}

export function TableRowSkeleton({
  columns = 4,
  rows = 5,
}: {
  readonly columns?: number | undefined;
  readonly rows?: number | undefined;
}) {
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <tr
          // biome-ignore lint/suspicious/noArrayIndexKey: lignes positionnelles
          key={r}
          aria-hidden
          className="border-b border-border last:border-0"
          data-slot="table-row-skeleton"
        >
          {Array.from({ length: columns }, (_, c) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: cellules positionnelles
            <td key={c} className="px-3 py-3">
              <Skeleton
                className={cn(
                  "h-3.5",
                  c === 0 ? "w-32" : WIDTHS[(r + c) % WIDTHS.length],
                )}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function ListSkeleton({
  rows = 4,
  avatar = true,
  className,
}: {
  readonly rows?: number | undefined;
  readonly avatar?: boolean | undefined;
  readonly className?: string | undefined;
}) {
  return (
    <ul
      aria-hidden
      className={cn("grid gap-1", className)}
      data-slot="list-skeleton"
    >
      {Array.from({ length: rows }, (_, i) => (
        <li
          // biome-ignore lint/suspicious/noArrayIndexKey: lignes positionnelles
          key={i}
          className="flex items-center gap-3 rounded-control px-2 py-2.5"
        >
          {avatar ? (
            <Skeleton className="size-8 shrink-0 rounded-pill" />
          ) : null}
          <div className="grid flex-1 gap-2">
            <Skeleton className={cn("h-3.5", i % 2 === 0 ? "w-40" : "w-52")} />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-6 w-16 rounded-pill" />
        </li>
      ))}
    </ul>
  );
}

export function ChartSkeleton({
  bars = 12,
  height = 180,
  className,
}: {
  readonly bars?: number | undefined;
  readonly height?: number | undefined;
  readonly className?: string | undefined;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "grid gap-4 rounded-card border border-border bg-card p-5",
        className,
      )}
      data-slot="chart-skeleton"
    >
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-7 w-24" />
      </div>
      <div
        className="flex items-end gap-2 border-b border-border"
        style={{ height }}
      >
        {Array.from({ length: bars }, (_, i) => (
          <Skeleton
            // biome-ignore lint/suspicious/noArrayIndexKey: barres positionnelles
            key={i}
            className="flex-1 rounded-b-none rounded-t-chip"
            style={{ height: `${HEIGHTS[i % HEIGHTS.length]}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between">
        {Array.from({ length: 4 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: graduations positionnelles
          <Skeleton key={i} className="h-2.5 w-10" />
        ))}
      </div>
    </div>
  );
}
