"use client";

/**
 * LineChart : une tendance, deux ou trois séries au plus. Points au survol
 * seulement ; les séries après la première sont en pointillés (comparaison).
 *
 * Props :
 * - `data`, `x`, `series` (`{ key, label, tone? }[]`, la première en jaune).
 * - `label` (obligatoire) : nom accessible ; `summary` ; `xLabel`.
 * - `marker` : une valeur de `x` marquée d'un trait vertical (« rappel envoyé ») ;
 *   `markerLabel` : son texte.
 * - `domain` : bornes de l'axe des valeurs (`[0, 100]` pour un pourcentage).
 * - `valueFormatter`, `integer`, `legend` (dès 2 séries), `id`, `className`.
 */
import {
  CartesianGrid,
  Line,
  LineChart as RechartsLine,
  ReferenceLine,
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

export interface LineChartProps {
  readonly data: readonly Datum[];
  readonly x: string;
  readonly series: readonly Series[];
  readonly label: string;
  readonly summary?: string | undefined;
  readonly xLabel?: string | undefined;
  readonly marker?: string | undefined;
  readonly markerLabel?: string | undefined;
  readonly domain?: readonly [number, number] | undefined;
  readonly integer?: boolean | undefined;
  readonly legend?: boolean | undefined;
  readonly valueFormatter?: ValueFormatter | undefined;
  readonly id?: string | undefined;
  readonly className?: string | undefined;
}

export function LineChart({
  data,
  x,
  series,
  label,
  summary,
  xLabel = x,
  marker,
  markerLabel,
  domain,
  integer = false,
  legend = series.length > 1,
  valueFormatter = formatNumber,
  id,
  className,
}: LineChartProps) {
  const config = toConfig(series);
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
        <RechartsLine
          accessibilityLayer={false}
          data={[...data]}
          margin={{ left: 0, right: 12, top: 12 }}
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
            {...(domain ? { domain: [...domain] } : {})}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tick={AXIS_TICK}
            tickFormatter={(v: number) => valueFormatter(v)}
          />
          <ChartTooltip
            cursor={{ stroke: GRID, strokeDasharray: "4 4" }}
            content={
              <ChartTooltipContent
                indicator="line"
                valueFormatter={valueFormatter}
              />
            }
          />
          {marker === undefined ? null : (
            <ReferenceLine
              x={marker}
              stroke="var(--muted-foreground)"
              strokeDasharray="4 4"
              {...(markerLabel
                ? {
                    label: {
                      value: markerLabel,
                      position: "insideTopRight" as const,
                      fontSize: 11,
                      fill: "var(--muted-foreground)",
                    },
                  }
                : {})}
            />
          )}
          {series.map((s, i) => (
            <Line
              key={s.key}
              dataKey={s.key}
              name={s.key}
              type="monotone"
              stroke={`var(--color-${s.key})`}
              strokeWidth={i === 0 ? 2.25 : 1.75}
              {...(i === 0 ? {} : { strokeDasharray: "5 4" })}
              dot={false}
              activeDot={{
                r: 4,
                fill: `var(--color-${s.key})`,
                strokeWidth: 0,
              }}
              {...motion}
              {...(motion.isAnimationActive ? { animationBegin: i * 120 } : {})}
            />
          ))}
          {legend ? (
            <ChartLegend itemSorter={null} content={<ChartLegendContent />} />
          ) : null}
        </RechartsLine>
      </ChartContainer>
    </ChartFigure>
  );
}
