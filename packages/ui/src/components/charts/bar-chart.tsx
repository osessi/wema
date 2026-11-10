"use client";

/**
 * BarChart : des catégories comparées, empilées quand les parts font un tout.
 *
 * Props :
 * - `data`, `x`, `series` (`{ key, label, tone? }[]`, la première en jaune).
 * - `label` (obligatoire) : nom accessible ; `summary` ; `xLabel`.
 * - `layout` : `"vertical"` (barres verticales, par défaut) ou
 *   `"horizontal"` (barres couchées, pour des libellés longs : matières…).
 * - `stacked`, `integer`, `legend` (dès 2 séries), `valueFormatter`, `id`,
 *   `className` (hauteur : `h-64`).
 */
import {
  Bar,
  CartesianGrid,
  BarChart as RechartsBar,
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

export interface BarChartProps {
  readonly data: readonly Datum[];
  readonly x: string;
  readonly series: readonly Series[];
  readonly label: string;
  readonly summary?: string | undefined;
  readonly xLabel?: string | undefined;
  readonly layout?: "vertical" | "horizontal" | undefined;
  readonly stacked?: boolean | undefined;
  readonly integer?: boolean | undefined;
  readonly legend?: boolean | undefined;
  readonly valueFormatter?: ValueFormatter | undefined;
  readonly id?: string | undefined;
  readonly className?: string | undefined;
}

export function BarChart({
  data,
  x,
  series,
  label,
  summary,
  xLabel = x,
  layout = "vertical",
  stacked = false,
  integer = false,
  legend = series.length > 1,
  valueFormatter = formatNumber,
  id,
  className,
}: BarChartProps) {
  const config = toConfig(series);
  const last = series.length - 1;
  const motion = useChartMotion();
  const lying = layout === "horizontal";
  const valueAxis = {
    type: "number" as const,
    allowDecimals: !integer,
    tickLine: false,
    axisLine: false,
    tickMargin: 8,
    tick: AXIS_TICK,
    tickFormatter: (v: number) => valueFormatter(v),
  };
  const categoryAxis = {
    type: "category" as const,
    dataKey: x,
    tickLine: false,
    axisLine: false,
    tickMargin: 8,
    tick: AXIS_TICK,
  };
  const end = 6;
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
        <RechartsBar
          accessibilityLayer={false}
          data={[...data]}
          layout={lying ? "vertical" : "horizontal"}
          margin={{ left: 0, right: 8, top: 8 }}
          barCategoryGap="30%"
          barGap={3}
        >
          <CartesianGrid
            vertical={lying}
            horizontal={!lying}
            strokeDasharray="3 3"
            stroke={GRID}
          />
          {lying ? (
            <>
              <XAxis {...valueAxis} />
              <YAxis {...categoryAxis} width="auto" />
            </>
          ) : (
            <>
              <XAxis {...categoryAxis} />
              <YAxis {...valueAxis} width="auto" />
            </>
          )}
          <ChartTooltip
            cursor={{ fill: "var(--accent)" }}
            content={<ChartTooltipContent valueFormatter={valueFormatter} />}
          />
          {series.map((s, i) => {
            const rounded = !stacked || i === last;
            const radius: [number, number, number, number] = lying
              ? [0, end, end, 0]
              : [end, end, 0, 0];
            return (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.key}
                fill={`var(--color-${s.key})`}
                maxBarSize={lying ? 22 : 32}
                {...(stacked ? { stackId: "stack" } : {})}
                radius={rounded ? radius : 0}
                {...motion}
                {...(motion.isAnimationActive
                  ? { animationBegin: i * 100 }
                  : {})}
              />
            );
          })}
          {legend ? (
            <ChartLegend itemSorter={null} content={<ChartLegendContent />} />
          ) : null}
        </RechartsBar>
      </ChartContainer>
    </ChartFigure>
  );
}
