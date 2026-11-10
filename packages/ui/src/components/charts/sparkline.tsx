/**
 * Sparkline : une mini-courbe en SVG pur (sans Recharts, rendue côté
 * serveur), pour une tuile de chiffre ou une ligne de tableau.
 *
 * Props :
 * - `values` : les valeurs dans l'ordre du temps (au moins deux).
 * - `label` : nom accessible (« Maîtrise : de 42 à 68 % en 8 semaines ») ;
 *   sans `label`, la courbe est décorative (`aria-hidden`).
 * - `tone` : ton de la palette (jaune par défaut) ; `width`, `height` (96 × 28) ;
 *   `area` : remplissage dégradé sous la courbe (oui par défaut) ; `className`.
 *
 * Entrée : un fondu court, coupé si l'utilisateur réduit les animations.
 */
import { type CSSProperties, useId } from "react";
import { cn } from "../../lib/utils";
import { CHART_TONES, type ChartTone } from "./palette";

export interface SparklineProps {
  readonly values: readonly number[];
  readonly label?: string | undefined;
  readonly tone?: ChartTone | undefined;
  readonly width?: number | undefined;
  readonly height?: number | undefined;
  readonly area?: boolean | undefined;
  readonly className?: string | undefined;
}

export function Sparkline({
  values,
  label,
  tone = "yellow",
  width = 96,
  height = 28,
  area = true,
  className,
}: SparklineProps) {
  const id = useId().replace(/:/g, "");
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((v, i) => [
    (i / (values.length - 1)) * width,
    height - 2 - ((v - min) / span) * (height - 4),
  ]);
  const line = points.map(([x, y]) => `${x},${y}`).join(" ");
  const fill = `0,${height} ${line} ${width},${height}`;
  const last = points[points.length - 1] ?? [width, height / 2];
  const { light, dark } = CHART_TONES[tone];
  return (
    <svg
      role="img"
      aria-label={label}
      aria-hidden={label ? undefined : true}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={cn(
        "shrink-0 overflow-visible text-(--spark-light) motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500 dark:text-(--spark-dark)",
        className,
      )}
      style={{ "--spark-light": light, "--spark-dark": dark } as CSSProperties}
    >
      {label ? <title>{label}</title> : null}
      {area ? (
        <>
          <defs>
            <linearGradient id={`spark-${id}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="currentColor" stopOpacity="0.35" />
              <stop offset="1" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={fill} fill={`url(#spark-${id})`} />
        </>
      ) : null}
      <polyline
        points={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={last[0]} cy={last[1]} r={2.25} fill="currentColor" />
    </svg>
  );
}
