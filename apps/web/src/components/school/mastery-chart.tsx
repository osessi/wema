"use client";

import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@wema/ui/components/ui/chart";
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "@wema/ui/components/ui/recharts";
import { useTranslations } from "next-intl";

/**
 * Part des notions validées et élèves actifs cette semaine, par classe.
 * Couleurs du site : jaune pour les actifs, encre pour les notions validées.
 * Barres horizontales au-delà de quatre classes.
 */
export function MasteryChart({
  data,
}: {
  data: { name: string; mastered: number; active: number }[];
}) {
  const t = useTranslations("school.overview");
  const config = {
    active: { label: t("chartActive"), color: "var(--chart-2)" },
    mastered: { label: t("chartMastered"), color: "var(--chart-1)" },
  } satisfies ChartConfig;
  const horizontal = data.length > 4;
  return (
    <ChartContainer
      config={config}
      className="aspect-auto w-full"
      style={{ height: horizontal ? Math.max(240, data.length * 56) : 256 }}
    >
      <BarChart
        data={data}
        layout={horizontal ? "vertical" : "horizontal"}
        margin={{ left: horizontal ? 8 : -16, right: 8 }}
        barGap={4}
      >
        <CartesianGrid
          vertical={horizontal}
          horizontal={!horizontal}
          strokeDasharray="3 3"
        />
        <XAxis
          {...(horizontal
            ? { type: "number" as const, domain: [0, 100], unit: " %" }
            : { type: "category" as const, dataKey: "name" })}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          {...(horizontal
            ? { type: "category" as const, dataKey: "name", width: 96 }
            : { type: "number" as const, domain: [0, 100], unit: " %" })}
          tickLine={false}
          axisLine={false}
        />
        <ChartTooltip
          cursor={{ fill: "var(--muted)", opacity: 0.6 }}
          content={<ChartTooltipContent />}
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar
          dataKey="active"
          fill="var(--color-active)"
          radius={6}
          maxBarSize={40}
        />
        <Bar
          dataKey="mastered"
          fill="var(--color-mastered)"
          radius={6}
          maxBarSize={40}
        />
      </BarChart>
    </ChartContainer>
  );
}
