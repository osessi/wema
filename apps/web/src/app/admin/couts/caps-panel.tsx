"use client";

import { Gauge, Plus, Trash, Warning } from "@phosphor-icons/react";
import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@wema/ui/components/ui/dialog";
import { toast } from "@wema/ui/components/ui/sonner";
import { ConfirmDialog } from "@wema/ui/components/wema/confirm-dialog";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import { cn } from "@wema/ui/lib/utils";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { CostsData } from "../../../lib/insights-types";
import { useMutation } from "../../../lib/use-mutation";
import { formatUsd } from "../_ui/days";
import { Notice, SelectField, TextField } from "../_ui/fields";
import { MonoLabel, Panel } from "../_ui/kit";

const GLOBAL = "global";
const pct = new Intl.NumberFormat("fr-FR", {
  style: "percent",
  maximumFractionDigits: 0,
});
const LEVEL_BADGE = {
  ok: "success",
  warning: "warning",
  blocked: "danger",
} as const;

/** Dialogue « Créer un plafond » : champs vides, exemples en placeholder. */
function NewCapDialog({
  organizations,
}: {
  organizations: { id: string; name: string }[];
}) {
  const t = useTranslations("insights.costs");
  const { run, pending, error } = useMutation();
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState(GLOBAL);
  const [monthly, setMonthly] = useState("");
  const [alertAt, setAlertAt] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus aria-hidden weight="bold" />
          {t("newCap")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("newCap")}</DialogTitle>
          <DialogDescription>{t("newCapHint")}</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const result = await run("PUT", "/admin/costs/caps", {
              organizationId: scope === GLOBAL ? null : scope,
              monthlyUsd: Number(monthly),
              alertRatio: Number(alertAt) / 100,
            });
            if (result.ok) {
              toast.success(t("capSaved"));
              setOpen(false);
            }
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
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label={t("monthly")}
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              required
              placeholder={t("monthlyPlaceholder")}
              value={monthly}
              onChange={(e) => setMonthly(e.target.value)}
            />
            <TextField
              label={t("alertAt")}
              type="number"
              min={10}
              max={100}
              required
              placeholder={t("alertAtPlaceholder")}
              hint={t("alertAtHint")}
              value={alertAt}
              onChange={(e) => setAlertAt(e.target.value)}
            />
          </div>
          {error ? <Notice tone="error">{error}</Notice> : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" variant="brand" disabled={pending}>
              {t("save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Plafonds mensuels (global et par organisation) en jauges, et alertes. */
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
  const { run, pending } = useMutation();
  const scopeName = (id: string | null, name: string | null) =>
    id === null ? t("global") : (name ?? id);

  return (
    <Panel
      icon={<Gauge weight="fill" />}
      tone="amber"
      title={t("caps")}
      description={t("capsHint")}
      actions={<NewCapDialog organizations={organizations} />}
      contentClassName="flex flex-col gap-6"
    >
      {caps.length === 0 ? (
        <EmptyState
          variant="inline"
          icon={<Gauge weight="fill" />}
          tone="amber"
          title={t("noCaps")}
          titleAs="p"
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {caps.map((c) => {
            const ratio = c.monthlyUsd > 0 ? c.spentUsd / c.monthlyUsd : 0;
            const name = scopeName(c.organizationId, c.organizationName);
            return (
              <li
                key={c.organizationId ?? GLOBAL}
                className="flex h-full flex-col gap-3 rounded-card border bg-muted/30 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-semibold">{name}</p>
                    <Badge variant={LEVEL_BADGE[c.level]}>
                      {t(`level.${c.level}`)}
                    </Badge>
                  </div>
                  <ConfirmDialog
                    trigger={
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={t("removeCap", { scope: name })}
                        disabled={pending}
                      >
                        <Trash />
                      </Button>
                    }
                    variant="destructive"
                    title={t("removeCap", { scope: name })}
                    description={t("removeCapHint")}
                    confirmLabel={t("remove")}
                    cancelLabel={t("cancel")}
                    onConfirm={async () =>
                      (
                        await run(
                          "DELETE",
                          c.organizationId
                            ? `/admin/costs/caps?organizationId=${c.organizationId}`
                            : "/admin/costs/caps",
                        )
                      ).ok
                    }
                  />
                </div>
                <meter
                  className="sr-only"
                  min={0}
                  max={c.monthlyUsd}
                  low={c.monthlyUsd * c.alertRatio}
                  value={Math.min(c.spentUsd, c.monthlyUsd)}
                  aria-label={t("spent")}
                  aria-valuetext={t("gaugeText", {
                    spent: formatUsd(c.spentUsd),
                    cap: formatUsd(c.monthlyUsd),
                  })}
                />
                <div
                  aria-hidden
                  className="relative h-2.5 overflow-visible rounded-full bg-muted"
                >
                  <span
                    className={cn(
                      "block h-full rounded-full",
                      c.level === "blocked"
                        ? "bg-destructive"
                        : c.level === "warning"
                          ? "bg-peach-ink"
                          : "bg-mint-ink",
                    )}
                    style={{ width: `${Math.min(100, ratio * 100)}%` }}
                  />
                  <span
                    aria-hidden
                    title={t("alertMarker")}
                    className="absolute -top-1 h-4.5 w-0.5 rounded-full bg-foreground/60"
                    style={{ left: `${Math.min(100, c.alertRatio * 100)}%` }}
                  />
                </div>
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <span className="tabular-nums">
                    <span className="font-semibold">
                      {formatUsd(c.spentUsd)}
                    </span>{" "}
                    <span className="text-muted-foreground">
                      {t("ofCap", { cap: formatUsd(c.monthlyUsd) })}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {t("alertAtValue", { value: pct.format(c.alertRatio) })}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <section aria-labelledby="caps-alerts" className="space-y-2">
        <MonoLabel>
          <span id="caps-alerts">{t("alerts")}</span>
        </MonoLabel>
        {alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noAlerts")}</p>
        ) : (
          <ul className="divide-y rounded-card border">
            {alerts.map((a) => (
              <li
                key={`${a.organizationId ?? GLOBAL}-${a.month}-${a.level}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm"
              >
                <Warning
                  aria-hidden
                  weight="fill"
                  className={cn(
                    "size-4",
                    a.level === "blocked"
                      ? "text-destructive"
                      : "text-peach-ink",
                  )}
                />
                <span className="font-mono text-xs text-muted-foreground">
                  {a.month}
                </span>
                <span className="font-medium">
                  {scopeName(a.organizationId, a.organizationName)}
                </span>
                <Badge variant={LEVEL_BADGE[a.level]}>
                  {t(`level.${a.level}`)}
                </Badge>
                <span className="ml-auto text-muted-foreground tabular-nums">
                  {t("ofCapLine", {
                    spent: formatUsd(a.spentUsd),
                    cap: formatUsd(a.capUsd),
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Panel>
  );
}
