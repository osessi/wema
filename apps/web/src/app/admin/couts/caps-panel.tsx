"use client";

import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
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
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import type { CostsData } from "../../../lib/insights-types";
import { useMutation } from "../../../lib/use-mutation";
import { EmptyState, SelectField, TextField } from "../_ui/fields";

const GLOBAL = "global";

/** Plafonds mensuels (global et par organisation) et alertes. */
export function CapsPanel({
  caps,
  alerts,
  organizations,
}: {
  caps: CostsData["caps"];
  alerts: CostsData["alerts"];
  organizations: { id: string; name: string }[];
}) {
  const t = useTranslations("insights.costs");
  const format = useFormatter();
  const { run, pending, error } = useMutation();
  const [scope, setScope] = useState(GLOBAL);
  const [monthly, setMonthly] = useState("50");
  const [alertAt, setAlertAt] = useState("80");
  const usd = (n: number) =>
    format.number(n, { style: "currency", currency: "USD" });
  const levelBadge = (level: "ok" | "warning" | "blocked") => (
    <Badge
      variant={level === "blocked" ? "default" : "outline"}
      className={level === "warning" ? "bg-peach text-peach-ink" : undefined}
    >
      {t(`level.${level}`)}
    </Badge>
  );
  const scopeName = (id: string | null, name: string | null) =>
    id === null ? t("global") : (name ?? id);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg">{t("caps")}</CardTitle>
        <CardDescription>{t("capsHint")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {caps.length === 0 ? (
          <EmptyState>{t("noCaps")}</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("scope")}</TableHead>
                  <TableHead className="text-right">{t("monthly")}</TableHead>
                  <TableHead className="text-right">{t("spent")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {caps.map((c) => (
                  <TableRow key={c.organizationId ?? GLOBAL}>
                    <TableCell>
                      {scopeName(c.organizationId, c.organizationName)}
                    </TableCell>
                    <TableCell className="text-right">
                      {usd(c.monthlyUsd)} ·{" "}
                      {format.number(c.alertRatio, { style: "percent" })}
                    </TableCell>
                    <TableCell className="text-right">
                      {usd(c.spentUsd)}
                    </TableCell>
                    <TableCell>{levelBadge(c.level)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          run(
                            "DELETE",
                            c.organizationId
                              ? `/admin/costs/caps?organizationId=${c.organizationId}`
                              : "/admin/costs/caps",
                          )
                        }
                      >
                        {t("remove")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <form
          className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end"
          onSubmit={async (e) => {
            e.preventDefault();
            await run("PUT", "/admin/costs/caps", {
              organizationId: scope === GLOBAL ? null : scope,
              monthlyUsd: Number(monthly),
              alertRatio: Number(alertAt) / 100,
            });
          }}
        >
          <SelectField
            label={t("scope")}
            value={scope}
            onChange={(e) => setScope(e.target.value)}
          >
            <option value={GLOBAL}>{t("global")}</option>
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </SelectField>
          <TextField
            label={t("monthly")}
            type="number"
            min={0}
            step="0.01"
            required
            value={monthly}
            onChange={(e) => setMonthly(e.target.value)}
          />
          <TextField
            label={t("alertAt")}
            type="number"
            min={10}
            max={100}
            required
            value={alertAt}
            onChange={(e) => setAlertAt(e.target.value)}
          />
          <Button type="submit" disabled={pending}>
            {t("save")}
          </Button>
        </form>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">{t("alerts")}</h3>
          {alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noAlerts")}</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {alerts.map((a) => (
                <li key={`${a.organizationId ?? GLOBAL}-${a.month}-${a.level}`}>
                  {t("alertLine", {
                    month: a.month,
                    scope: scopeName(a.organizationId, a.organizationName),
                    level: t(`level.${a.level}`),
                    spent: usd(a.spentUsd),
                    cap: usd(a.capUsd),
                  })}
                </li>
              ))}
            </ul>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
