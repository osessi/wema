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
import { formatUsd } from "../_ui/days";

const dayLabel = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/** Dépense quotidienne en barres, jours sans appel compris (à zéro). */
export function DailyChart({
  days,
}: {
  days: { day: string; costUsd: number; calls: number }[];
}) {
  const t = useTranslations("insights.costs");
  const config = {
    costUsd: { label: t("cost"), color: "var(--chart-2)" },
  } satisfies ChartConfig;
  const data = days.map((d) => ({
    ...d,
    label: dayLabel.format(new Date(`${d.day}T12:00:00Z`)),
  }));
  return (
    <ChartContainer
      config={config}
      className="aspect-auto h-56 w-full"
      role="img"
      aria-label={t("dailyAria", {
        days: days.length,
        max: formatUsd(Math.max(0, ...days.map((d) => d.costUsd))),
      })}
    >
      <BarChart data={data} margin={{ left: 4, right: 4, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          minTickGap={16}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={64}
          tickFormatter={(v: number) => formatUsd(v)}
        />
        <ChartTooltip
          cursor={{ fill: "var(--muted)", opacity: 0.6 }}
          content={
            <ChartTooltipContent
              formatter={(value, _name, item) => (
                <span className="flex w-full items-center justify-between gap-4">
                  <span className="text-muted-foreground">
                    {t("callsCount", {
                      count:
                        typeof item.payload?.calls === "number"
                          ? item.payload.calls
                          : 0,
                    })}
                  </span>
                  <span className="font-mono font-medium tabular-nums">
                    {formatUsd(Number(value))}
                  </span>
                </span>
              )}
            />
          }
        />
        <Bar
          dataKey="costUsd"
          fill="var(--color-costUsd)"
          radius={[4, 4, 0, 0]}
          maxBarSize={36}
          isAnimationActive={false}
        />
      </BarChart>
    </ChartContainer>
  );
}
