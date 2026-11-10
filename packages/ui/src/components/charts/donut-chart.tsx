"use client";

/**
 * DonutChart : les parts d'un tout, le total (ou un chiffre choisi) au centre.
 *
 * Props :
 * - `data` : `{ name, value, tone? }[]` (tons dans l'ordre de la palette
 *   par défaut ; donnez un ton qui a du sens : menthe = acquis, rose = à revoir).
 * - `label` (obligatoire) : nom accessible ; `summary`.
 * - `centerValue` (par défaut : le total formaté), `centerLabel`.
 * - `shape` : `"full"` (par défaut) ou `"half"` (demi-anneau).
 * - `legend` (par défaut oui, avec valeurs et parts), `valueFormatter`, `id`,
 *   `className`.
 */
import { Cell, Label, Pie, PieChart } from "recharts";
import { cn } from "../../lib/utils";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "../ui/chart";
import { ChartFigure } from "./chart-figure";
import { type ChartTone, toneAt, toneColor } from "./palette";
import { formatNumber, type ValueFormatter } from "./series";
import { useChartMotion } from "./use-chart-motion";

export interface DonutSlice {
  readonly name: string;
  readonly value: number;
  readonly tone?: ChartTone | undefined;
}

export interface DonutChartProps {
  readonly data: readonly DonutSlice[];
  readonly label: string;
  readonly summary?: string | undefined;
  readonly centerValue?: string | undefined;
  readonly centerLabel?: string | undefined;
  readonly shape?: "full" | "half" | undefined;
  readonly legend?: boolean | undefined;
  readonly valueFormatter?: ValueFormatter | undefined;
  readonly id?: string | undefined;
  readonly className?: string | undefined;
}

const percent = new Intl.NumberFormat("fr-FR", {
  style: "percent",
  maximumFractionDigits: 0,
});

export function DonutChart({
  data,
  label,
  summary,
  centerValue,
  centerLabel,
  shape = "full",
  legend = true,
  valueFormatter = formatNumber,
  id,
  className,
}: DonutChartProps) {
  const motion = useChartMotion();
  const slices = data.map((d, i) => ({
    name: d.name,
    value: d.value,
    color: toneColor(d.tone ?? toneAt(i)),
  }));
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const share = (v: number) => percent.format(total > 0 ? v / total : 0);
  const config = Object.fromEntries(
    slices.map((s) => [s.name, { label: s.name, color: s.color }]),
  );
  const half = shape === "half";
  return (
    <ChartFigure
      label={label}
      summary={summary}
      table={{
        head: ["Part", "Valeur", "Proportion"],
        rows: slices.map((s) => [
          s.name,
          valueFormatter(s.value),
          share(s.value),
        ]),
      }}
      className={cn("flex w-full flex-col items-center", className)}
    >
      <ChartContainer
        id={id}
        config={config}
        className={cn(
          "mx-auto w-full",
          half ? "aspect-[2/1.1] max-h-44" : "aspect-square max-h-56",
        )}
      >
        <PieChart accessibilityLayer={false}>
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                nameKey="name"
                hideLabel
                valueFormatter={valueFormatter}
              />
            }
          />
          <Pie
            data={slices}
            dataKey="value"
            nameKey="name"
            startAngle={half ? 180 : 90}
            endAngle={half ? 0 : -270}
            cy={half ? "88%" : "50%"}
            innerRadius={half ? "110%" : "68%"}
            outerRadius={half ? "160%" : "96%"}
            paddingAngle={2}
            cornerRadius={4}
            strokeWidth={0}
            {...motion}
          >
            {slices.map((s) => (
              <Cell key={s.name} fill={s.color} stroke="none" />
            ))}
            <Label
              content={({ viewBox }) => {
                if (!viewBox || !("cx" in viewBox) || !("cy" in viewBox)) {
                  return null;
                }
                const cx = viewBox.cx ?? 0;
                const cy = viewBox.cy ?? 0;
                return (
                  <text x={cx} y={cy} textAnchor="middle">
                    <tspan
                      x={cx}
                      y={half ? cy - 8 : centerLabel ? cy + 2 : cy + 9}
                      className="fill-foreground text-[28px] font-light tracking-tight tabular-nums"
                    >
                      {centerValue ?? valueFormatter(total)}
                    </tspan>
                    {centerLabel ? (
                      <tspan
                        x={cx}
                        y={half ? cy + 12 : cy + 22}
                        className="fill-muted-foreground text-[11px]"
                      >
                        {centerLabel}
                      </tspan>
                    ) : null}
                  </text>
                );
              }}
            />
          </Pie>
        </PieChart>
      </ChartContainer>
      {legend ? (
        <ul className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
          {slices.map((s) => (
            <li
              key={s.name}
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <span
                className="size-2.5 rounded-full"
                style={{ background: s.color }}
              />
              {s.name}
              <span className="font-medium text-foreground tabular-nums">
                {valueFormatter(s.value)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </ChartFigure>
  );
}
