"use client";

/**
 * AreaChart : une quantité dans le temps, l'aire suggère le volume.
 *
 * Props :
 * - `data` : lignes de données ; `x` : clé de l'abscisse (souvent une date).
 * - `series` : `{ key, label, tone? }[]`, la première en jaune.
 * - `label` (obligatoire) : nom accessible ; `summary` : résumé lu à la place
 *   du tableau masqué ; `xLabel` : en-tête de la colonne `x` du tableau.
 * - `valueFormatter` : format des valeurs (axe, infobulle, tableau), `fr-FR`.
 * - `stacked`, `integer` (graduations entières), `legend` (dès 2 séries),
 *   `id` (stable si rendu côté serveur), `className` (hauteur : `h-64`).
 */
import { useId } from "react";
import {
  Area,
  CartesianGrid,
  AreaChart as RechartsArea,
  XAxis,
  YAxis,
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

export interface AreaChartProps {
  readonly data: readonly Datum[];
  readonly x: string;
  readonly series: readonly Series[];
  readonly label: string;
  readonly summary?: string | undefined;
  readonly xLabel?: string | undefined;
  readonly valueFormatter?: ValueFormatter | undefined;
  readonly stacked?: boolean | undefined;
  readonly integer?: boolean | undefined;
  readonly legend?: boolean | undefined;
  readonly id?: string | undefined;
  readonly className?: string | undefined;
}

export function AreaChart({
  data,
  x,
  series,
  label,
  summary,
  xLabel = x,
  valueFormatter = formatNumber,
  stacked = false,
  integer = false,
  legend = series.length > 1,
  id,
  className,
}: AreaChartProps) {
  const config = toConfig(series);
  const generated = useId().replace(/:/g, "");
  const gradient = `area-${id ?? generated}`;
  const motion = useChartMotion();
  return (
    <ChartFigure
      label={label}
      summary={summary}
      table={seriesTable(data, x, xLabel, series, valueFormatter)}
    >
      <ChartContainer
        id={id}
        config={config}
        className={cn("aspect-auto h-64 w-full", className)}
      >
        <RechartsArea
          accessibilityLayer={false}
          data={[...data]}
          margin={{ left: 0, right: 8, top: 8 }}
        >
          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={GRID} />
          <XAxis
            dataKey={x}
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            tick={AXIS_TICK}
          />
          <YAxis
            width="auto"
            allowDecimals={!integer}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tick={AXIS_TICK}
            tickFormatter={(v: number) => valueFormatter(v)}
          />
          <ChartTooltip
            cursor={{ stroke: GRID, strokeDasharray: "4 4" }}
            content={<ChartTooltipContent valueFormatter={valueFormatter} />}
          />
          <defs>
            {series.map((s) => (
              <linearGradient
                key={s.key}
                id={`${gradient}-${s.key}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="5%"
                  stopColor={`var(--color-${s.key})`}
                  stopOpacity={0.32}
                />
                <stop
                  offset="95%"
                  stopColor={`var(--color-${s.key})`}
                  stopOpacity={0.02}
                />
              </linearGradient>
            ))}
          </defs>
          {series.map((s) => (
            <Area
              key={s.key}
              dataKey={s.key}
              name={s.key}
              type="monotone"
              {...(stacked ? { stackId: "stack" } : {})}
              fill={`url(#${gradient}-${s.key})`}
              fillOpacity={1}
              stroke={`var(--color-${s.key})`}
              strokeWidth={2}
              activeDot={{ r: 4, strokeWidth: 0 }}
              {...motion}
            />
          ))}
          {legend ? (
            <ChartLegend itemSorter={null} content={<ChartLegendContent />} />
          ) : null}
        </RechartsArea>
      </ChartContainer>
    </ChartFigure>
  );
}
