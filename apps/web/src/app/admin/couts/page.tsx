import {
  Books,
  Buildings,
  CalendarBlank,
  Cpu,
  CurrencyDollar,
  ListChecks,
  PhoneCall,
  Student,
  UserCircle,
} from "@phosphor-icons/react/dist/ssr";
import { Badge } from "@wema/ui/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@wema/ui/components/ui/table";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import { StatTile } from "@wema/ui/components/wema/stat-tile";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { PageHeader } from "../../../components/page-header";
import { load, serverApi } from "../../../lib/api-server";
import { fillDays, formatUsd, usdOptions } from "../_ui/days";
import { Code, Panel } from "../_ui/kit";
import { CapsPanel } from "./caps-panel";
import { DailyChart } from "./daily-chart";

const nf = new Intl.NumberFormat("fr-FR");
const pct = new Intl.NumberFormat("fr-FR", {
  style: "percent",
  maximumFractionDigits: 0,
});

/** Part du total : barre fine et pourcentage, alignés à droite. */
function Share({ value, total }: { value: number; total: number }) {
  const ratio = total > 0 ? value / total : 0;
  return (
    <span className="ml-auto flex w-28 items-center justify-end gap-2">
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <span
          className="block h-full rounded-full bg-brand"
          style={{ width: `${Math.max(ratio > 0 ? 3 : 0, ratio * 100)}%` }}
        />
      </span>
      <span className="w-9 text-right text-xs text-muted-foreground tabular-nums">
        {pct.format(ratio)}
      </span>
    </span>
  );
}

export default async function CostsPage() {
  const t = await getTranslations("insights.costs");
  const tAi = await getTranslations("ai");
  const api = await serverApi();
  const [data, { organizations }] = await Promise.all([
    load(api.admin.costs.$get({ query: {} })),
    load(api.admin.organizations.$get()),
  ]);
  const calls = data.daily.reduce((s, d) => s + d.calls, 0);
  const errors = data.daily.reduce((s, d) => s + d.errors, 0);
  const total = data.totalCostUsd;
  const taskName = (key: string) =>
    tAi.has(`taskNames.${key}`) ? tAi(`taskNames.${key}`) : key;
  // Tous les jours de la période, y compris ceux sans appel (à zéro).
  const daily = fillDays(data.daily);
  const essential = new Set<string>(data.essentialTasks);
  const bySubjectTotal = data.bySubject.reduce((s, x) => s + x.costUsd, 0);
  // Écart avec le total : appels hors séance de travail sur une matière.
  const unassigned = Math.max(0, total - bySubjectTotal);

  const usageTable = (
    rows: typeof data.byTask,
    head: string,
    label: (key: string | null) => ReactNode,
  ) => (
    <Table className="min-w-[600px]">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>{head}</TableHead>
          <TableHead className="text-right">{t("calls")}</TableHead>
          <TableHead className="text-right">{t("errors")}</TableHead>
          <TableHead className="text-right">{t("cost")}</TableHead>
          <TableHead className="text-right">{t("share")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[...rows]
          .sort((a, b) => b.costUsd - a.costUsd)
          .map((r) => (
            <TableRow key={r.key ?? "none"}>
              <TableCell className="whitespace-normal">
                {label(r.key)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {nf.format(r.calls)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {r.errors > 0 ? (
                  <Badge variant="danger" className="tabular-nums">
                    {nf.format(r.errors)}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">0</span>
                )}
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                {formatUsd(r.costUsd)}
              </TableCell>
              <TableCell>
                <Share value={r.costUsd} total={total} />
              </TableCell>
            </TableRow>
          ))}
      </TableBody>
    </Table>
  );

  const noData = (
    <EmptyState
      variant="inline"
      icon={<CalendarBlank weight="fill" />}
      title={t("noData")}
      titleAs="p"
    />
  );

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <section
        aria-label={t("kpis")}
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 [&>*]:h-full"
      >
        <StatTile
          label={t("total")}
          value={total}
          format={usdOptions(total)}
          icon={<CurrencyDollar weight="bold" />}
          tone="rose"
          trend={daily.length > 1 ? daily.map((d) => d.costUsd) : undefined}
          hint={t("last30")}
        />
        <StatTile
          label={t("perLearner")}
          value={data.learners.costPerActiveLearnerUsd}
          format={usdOptions(data.learners.costPerActiveLearnerUsd)}
          icon={<UserCircle weight="fill" />}
          tone="amber"
          hint={t("perLearnerHint")}
        />
        <StatTile
          label={t("activeLearners")}
          value={data.learners.activeLearners}
          icon={<Student weight="fill" />}
          tone="mint"
        />
        <StatTile
          label={t("calls")}
          value={calls}
          icon={<PhoneCall weight="fill" />}
          tone="sky"
          hint={t("errorsHint", { count: errors })}
        />
      </section>

      <Panel
        icon={<CalendarBlank weight="fill" />}
        tone="rose"
        title={t("daily")}
        description={t("dailyHint")}
      >
        {daily.length === 0 ? noData : <DailyChart days={daily} />}
      </Panel>

      <CapsPanel
        caps={data.caps}
        alerts={data.alerts}
        organizations={organizations.map((o) => ({ id: o.id, name: o.name }))}
      />

      <Panel
        icon={<ListChecks weight="bold" />}
        tone="slate"
        title={t("byTask")}
        description={t("byTaskHint")}
        flush={data.byTask.length > 0}
      >
        {data.byTask.length === 0
          ? noData
          : usageTable(data.byTask, t("task"), (key) =>
              key ? (
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span title={key}>{taskName(key)}</span>
                  {essential.has(key) ? (
                    <Badge variant="brand">{t("essential")}</Badge>
                  ) : null}
                </span>
              ) : (
                <span className="text-muted-foreground">
                  {t("unknownTask")}
                </span>
              ),
            )}
      </Panel>
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Panel
          icon={<Cpu weight="fill" />}
          tone="yellow"
          title={t("byModel")}
          flush={data.byModel.length > 0}
        >
          {data.byModel.length === 0
            ? noData
            : usageTable(data.byModel, t("model"), (key) => <Code>{key}</Code>)}
        </Panel>
        <Panel
          icon={<Buildings weight="fill" />}
          tone="mint"
          title={t("byOrganization")}
          flush={data.byOrganization.length > 0}
        >
          {data.byOrganization.length === 0 ? (
            noData
          ) : (
            <Table className="min-w-[520px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>{t("organization")}</TableHead>
                  <TableHead className="text-right">{t("calls")}</TableHead>
                  <TableHead className="text-right">{t("cost")}</TableHead>
                  <TableHead className="text-right">{t("share")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.byOrganization.map((o) => (
                  <TableRow key={o.organizationId ?? "none"}>
                    <TableCell
                      className={
                        o.organizationName
                          ? "font-medium"
                          : "text-muted-foreground"
                      }
                    >
                      {o.organizationName ?? t("noOrganization")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {nf.format(o.calls)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatUsd(o.costUsd)}
                    </TableCell>
                    <TableCell>
                      <Share value={o.costUsd} total={total} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Panel>
      </div>
      <Panel
        icon={<Books weight="fill" />}
        tone="sky"
        title={t("bySubject")}
        description={t("bySubjectHint")}
        flush={data.bySubject.length > 0 || unassigned > 0}
      >
        {data.bySubject.length === 0 && unassigned === 0 ? (
          noData
        ) : (
          <Table className="min-w-[520px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t("subject")}</TableHead>
                <TableHead className="text-right">{t("learners")}</TableHead>
                <TableHead className="text-right">{t("cost")}</TableHead>
                <TableHead className="text-right">
                  {t("costPerLearner")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.bySubject.map((s) => (
                <TableRow key={s.subjectId}>
                  <TableCell className="font-medium">{s.subjectName}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {nf.format(s.activeLearners)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatUsd(s.costUsd)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatUsd(s.costPerLearnerUsd)}
                  </TableCell>
                </TableRow>
              ))}
              {unassigned > 0 ? (
                <TableRow>
                  <TableCell className="whitespace-normal text-muted-foreground">
                    <span className="flex flex-col">
                      {t("unassigned")}
                      <span className="text-xs">{t("unassignedHint")}</span>
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    –
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatUsd(unassigned)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    –
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
            <TableFooter>
              <TableRow className="hover:bg-transparent">
                <TableCell className="font-medium">{t("totalRow")}</TableCell>
                <TableCell />
                <TableCell className="text-right font-medium tabular-nums">
                  {formatUsd(total)}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </Panel>
    </>
  );
}
