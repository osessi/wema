import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@wema/ui/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@wema/ui/components/ui/table";
import { getFormatter, getTranslations } from "next-intl/server";
import type { AiUsageData } from "../../../lib/admin-ai-types";
import { EmptyState } from "../_ui/fields";

/** Consommation de l'IA par tâche, sur les 30 derniers jours. */
export async function UsageTable({ usage }: { usage: AiUsageData }) {
  const t = await getTranslations("ai");
  const format = await getFormatter();
  const usd = (n: number) =>
    format.number(n, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 4,
    });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg">
          {t("usageTitle")}
        </CardTitle>
        <CardDescription>
          {t("usageText", { total: usd(usage.totalCostUsd) })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {usage.rows.length === 0 ? (
          <EmptyState>{t("usageNone")}</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("task")}</TableHead>
                  <TableHead className="text-right">{t("calls")}</TableHead>
                  <TableHead className="text-right">{t("errors")}</TableHead>
                  <TableHead className="text-right">{t("tokens")}</TableHead>
                  <TableHead className="text-right">{t("latency")}</TableHead>
                  <TableHead className="text-right">{t("cost")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usage.rows.map((r) => (
                  <TableRow key={r.key ?? "none"}>
                    <TableCell className="font-mono text-sm">
                      {r.key ?? t("unknownTask")}
                    </TableCell>
                    <TableCell className="text-right">
                      {format.number(r.calls)}
                    </TableCell>
                    <TableCell className="text-right">
                      {format.number(r.errors)}
                    </TableCell>
                    <TableCell className="text-right">
                      {format.number(r.inputTokens + r.outputTokens)}
                    </TableCell>
                    <TableCell className="text-right">
                      {t("ms", { value: r.avgLatencyMs })}
                    </TableCell>
                    <TableCell className="text-right">
                      {usd(r.costUsd)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
