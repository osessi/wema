"use client";

import { BarChart } from "@wema/ui/components/charts/index";

/** Répartition par statut au début et à la fin de la période (graphique de DS1). */
export function StatusChart({
  data,
  label,
  startLabel,
  endLabel,
}: {
  data: { status: string; start: number; end: number }[];
  label: string;
  startLabel: string;
  endLabel: string;
}) {
  return (
    <BarChart
      data={data}
      x="status"
      label={label}
      integer
      series={[
        { key: "start", label: startLabel, tone: "slate" },
        { key: "end", label: endLabel, tone: "mint" },
      ]}
      className="h-64 print:h-56"
    />
  );
}
