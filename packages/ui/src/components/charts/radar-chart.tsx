"use client";

/**
 * RadarChart : un profil sur plusieurs axes (compréhension, autonomie,
 * régularité…), un ou deux profils superposés. Pas pour le temps.
 *
 * Props :
 * - `data` : une ligne par axe ; `axis` : clé du nom de l'axe.
 * - `series` : `{ key, label, tone? }[]` (la première en jaune, pleine ;
 *   la deuxième, une référence, plus pâle).
 * - `label` (obligatoire) : nom accessible ; `summary` ; `axisLabel` (en-tête
 *   du tableau masqué).
 * - `max` : borne des axes (par défaut 100) ; `valueFormatter` ; `legend`
 *   (dès 2 séries) ; `id` ; `className`.
 */
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart as RechartsRadar,
} from "recharts";
import { cn } from "../../lib/utils";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "../ui/chart";
import { ChartFigure, seriesTable } from "./chart-figure";
import { AXIS_TICK, GRID } from "./palette";
import {
  type Datum,
  formatNumber,
  type Series,
  toConfig,
  type ValueFormatter,
} from "./series";
import { useChartMotion } from "./use-chart-motion";

export interface RadarChartProps {
  readonly data: readonly Datum[];
  readonly axis: string;
  readonly series: readonly Series[];
  readonly label: string;
  readonly summary?: string | undefined;
  readonly axisLabel?: string | undefined;
  readonly max?: number | undefined;
  readonly legend?: boolean | undefined;
  readonly valueFormatter?: ValueFormatter | undefined;
  readonly id?: string | undefined;
  readonly className?: string | undefined;
}

export function RadarChart({
  data,
  axis,
  series,
  label,
  summary,
  axisLabel = axis,
  max = 100,
  legend = series.length > 1,
  valueFormatter = formatNumber,
  id,
  className,
}: RadarChartProps) {
  const config = toConfig(series);
  const motion = useChartMotion();
  return (
    <ChartFigure
      label={label}
      summary={summary}
      table={seriesTable(data, axis, axisLabel, series, valueFormatter)}
    >
      <ChartContainer
        id={id}
        config={config}
        className={cn("mx-auto aspect-square w-full max-h-72", className)}
      >
        <RechartsRadar
          accessibilityLayer={false}
          data={[...data]}
          outerRadius="70%"
          margin={{ top: 8, bottom: 8, left: 24, right: 24 }}
        >
          <PolarGrid gridType="polygon" stroke={GRID} />
          <PolarRadiusAxis domain={[0, max]} tick={false} axisLine={false} />
          <PolarAngleAxis dataKey={axis} tick={AXIS_TICK} />
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent valueFormatter={valueFormatter} />}
          />
          {series.map((s, i) => (
            <Radar
              key={s.key}
              name={s.key}
              dataKey={s.key}
              stroke={`var(--color-${s.key})`}
              strokeWidth={i === 0 ? 2 : 1.5}
              {...(i === 0 ? {} : { strokeDasharray: "4 4" })}
              fill={`var(--color-${s.key})`}
              fillOpacity={i === 0 ? 0.28 : 0.08}
              dot={i === 0 ? { r: 3, fillOpacity: 1 } : false}
              {...motion}
            />
          ))}
          {legend ? (
            <ChartLegend itemSorter={null} content={<ChartLegendContent />} />
          ) : null}
        </RechartsRadar>
      </ChartContainer>
    </ChartFigure>
  );
}
