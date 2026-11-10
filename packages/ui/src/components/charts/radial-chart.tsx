"use client";

/**
 * RadialChart : quelques catégories (six au plus) rapportées au même
 * maximum, une piste par catégorie. Bon pour « où en est chaque chapitre ».
 *
 * Props :
 * - `data` : `{ name, value, tone? }[]`.
 * - `max` : la valeur d'une piste pleine (par défaut 100, un pourcentage).
 * - `label` (obligatoire) : nom accessible ; `summary`.
 * - `valueFormatter` (par défaut `fr-FR`), `id`, `className`.
 */
import { PolarAngleAxis, RadialBar, RadialBarChart } from "recharts";
import { cn } from "../../lib/utils";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "../ui/chart";
import { ChartFigure } from "./chart-figure";
import { type ChartTone, toneAt, toneColor } from "./palette";
import { formatNumber, type ValueFormatter } from "./series";
import { useChartMotion } from "./use-chart-motion";

export interface RadialItem {
  readonly name: string;
  readonly value: number;
  readonly tone?: ChartTone | undefined;
}

export interface RadialChartProps {
  readonly data: readonly RadialItem[];
  readonly label: string;
  readonly summary?: string | undefined;
  readonly max?: number | undefined;
  readonly valueFormatter?: ValueFormatter | undefined;
  readonly id?: string | undefined;
  readonly className?: string | undefined;
}

export function RadialChart({
  data,
  label,
  summary,
  max = 100,
  valueFormatter = formatNumber,
  id,
  className,
}: RadialChartProps) {
  const motion = useChartMotion();
  // Recharts dessine la première donnée au centre : on inverse pour lire de
  // l'extérieur vers l'intérieur dans l'ordre de la légende.
  const items = data.map((d, i) => ({
    name: d.name,
    value: d.value,
    fill: toneColor(d.tone ?? toneAt(i)),
  }));
  const config = Object.fromEntries(
    items.map((s) => [s.name, { label: s.name, color: s.fill }]),
  );
  return (
    <ChartFigure
      label={label}
      summary={summary}
      table={{
        head: ["Catégorie", "Valeur"],
        rows: items.map((s) => [s.name, valueFormatter(s.value)]),
      }}
      className={cn("flex flex-col items-center gap-3", className)}
    >
      <ChartContainer
        id={id}
        config={config}
        className="mx-auto aspect-square w-full max-h-56"
      >
        <RadialBarChart
          accessibilityLayer={false}
          data={[...items].reverse()}
          startAngle={90}
          endAngle={-270}
          innerRadius="28%"
          outerRadius="100%"
          barSize={10}
        >
          <PolarAngleAxis type="number" domain={[0, max]} tick={false} />
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
          <RadialBar
            dataKey="value"
            background={{ fill: "var(--muted)" }}
            cornerRadius={8}
            {...motion}
          />
        </RadialBarChart>
      </ChartContainer>
      <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1.5">
        {items.map((s) => (
          <li
            key={s.name}
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            <span
              className="size-2.5 rounded-full"
              style={{ background: s.fill }}
            />
            {s.name}
            <span className="font-medium text-foreground tabular-nums">
              {valueFormatter(s.value)}
            </span>
          </li>
        ))}
      </ul>
    </ChartFigure>
  );
}
