"use client";

import { AreaChart, DonutChart } from "@wema/ui/components/charts/index";
import { useTranslations } from "next-intl";
import { formatUsd } from "../_ui/days";

const dayLabel = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/** Dépense quotidienne en aire, jours sans appel compris (à zéro). */
export function DailyCostChart({
  days,
  className,
}: {
  days: { day: string; costUsd: number; calls: number }[];
  className?: string | undefined;
}) {
  const t = useTranslations("insights.costs");
  return (
    <AreaChart
      id="admin-daily-cost"
      label={t("daily")}
      summary={t("dailyAria", {
        days: days.length,
        max: formatUsd(Math.max(0, ...days.map((d) => d.costUsd))),
      })}
      data={days.map((d) => ({
        jour: dayLabel.format(new Date(`${d.day}T12:00:00Z`)),
        costUsd: d.costUsd,
      }))}
      x="jour"
      xLabel={t("day")}
      series={[{ key: "costUsd", label: t("cost"), tone: "rose" }]}
      valueFormatter={formatUsd}
      className={className ?? "h-60"}
    />
  );
}

/** Parts du coût total (par tâche ou par modèle), le total au centre. */
export function CostDonut({
  id,
  label,
  slices,
}: {
  id: string;
  label: string;
  slices: { name: string; value: number }[];
}) {
  const t = useTranslations("insights.costs");
  return (
    <DonutChart
      id={id}
      label={label}
      data={slices}
      centerLabel={t("total30")}
      valueFormatter={formatUsd}
    />
  );
}
