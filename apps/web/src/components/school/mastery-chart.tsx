"use client";

import {
  type ChartConfig,
  ChartContainer,
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

/** Part des notions validées et élèves actifs cette semaine, par classe. */
export function MasteryChart({
  data,
}: {
  data: { name: string; mastered: number; active: number }[];
}) {
  const t = useTranslations("school.overview");
  const config = {
    mastered: { label: t("chartMastered"), color: "var(--chart-1)" },
    active: { label: t("chartActive"), color: "var(--chart-3)" },
  } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      <BarChart data={data} margin={{ left: -16, right: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="name" tickLine={false} axisLine={false} />
        <YAxis domain={[0, 100]} tickLine={false} axisLine={false} unit=" %" />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="mastered" fill="var(--color-mastered)" radius={4} />
        <Bar dataKey="active" fill="var(--color-active)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}
