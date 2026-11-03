import { Badge } from "@wema/ui/components/ui/badge";
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
import type { ReactNode } from "react";
import { PageHeader } from "../../../components/page-header";
import { load, serverApi } from "../../../lib/api-server";
import { EmptyState } from "../_ui/fields";
import { CapsPanel } from "./caps-panel";

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg">{title}</CardTitle>
        {hint && <CardDescription>{hint}</CardDescription>}
      </CardHeader>
      <CardContent className="overflow-x-auto">{children}</CardContent>
    </Card>
  );
}

export default async function CostsPage() {
  const t = await getTranslations("insights.costs");
  const format = await getFormatter();
  const api = await serverApi();
  const [data, { organizations }] = await Promise.all([
    load(api.admin.costs.$get({ query: {} })),
    load(api.admin.organizations.$get()),
  ]);
  const usd = (n: number) =>
    format.number(n, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: n !== 0 && Math.abs(n) < 1 ? 4 : 2,
    });
  const calls = data.daily.reduce((s, d) => s + d.calls, 0);
  const maxDay = Math.max(0, ...data.daily.map((d) => d.costUsd));
  const essential = new Set<string>(data.essentialTasks);

  const kpis = [
    { label: t("total"), value: usd(data.totalCostUsd) },
    {
      label: t("perLearner"),
      value: usd(data.learners.costPerActiveLearnerUsd),
    },
    {
      label: t("activeLearners"),
      value: format.number(data.learners.activeLearners),
    },
    { label: t("calls"), value: format.number(calls) },
  ];

  const usageTable = (
    rows: typeof data.byTask,
    head: string,
    label: (key: string | null) => ReactNode,
  ) =>
    rows.length === 0 ? (
      <EmptyState>{t("noData")}</EmptyState>
    ) : (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{head}</TableHead>
            <TableHead className="text-right">{t("calls")}</TableHead>
            <TableHead className="text-right">{t("errors")}</TableHead>
            <TableHead className="text-right">{t("cost")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.key ?? "none"}>
              <TableCell className="font-mono text-sm">
                {label(r.key)}
              </TableCell>
              <TableCell className="text-right">
                {format.number(r.calls)}
              </TableCell>
              <TableCell className="text-right">
                {format.number(r.errors)}
              </TableCell>
              <TableCell className="text-right">{usd(r.costUsd)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border bg-card p-4">
            <dt className="text-sm text-muted-foreground">{k.label}</dt>
            <dd className="font-display text-2xl font-bold">{k.value}</dd>
          </div>
        ))}
      </dl>

      <CapsPanel
        caps={data.caps}
        alerts={data.alerts}
        organizations={organizations.map((o) => ({ id: o.id, name: o.name }))}
      />

      <Section title={t("daily")}>
        {data.daily.length === 0 ? (
          <EmptyState>{t("noData")}</EmptyState>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {data.daily.map((d) => (
              <li
                key={d.day}
                className="grid grid-cols-[6.5rem_1fr_5.5rem] items-center gap-3"
              >
                <span className="text-muted-foreground">
                  {format.dateTime(new Date(`${d.day}T12:00:00Z`), {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
                <span className="h-2.5 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-primary"
                    style={{
                      width: `${maxDay > 0 ? (d.costUsd / maxDay) * 100 : 0}%`,
                    }}
                  />
                </span>
                <span className="text-right tabular-nums">
                  {usd(d.costUsd)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t("bySubject")} hint={t("bySubjectHint")}>
        {data.bySubject.length === 0 ? (
          <EmptyState>{t("noData")}</EmptyState>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
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
                  <TableCell>{s.subjectName}</TableCell>
                  <TableCell className="text-right">
                    {format.number(s.activeLearners)}
                  </TableCell>
                  <TableCell className="text-right">{usd(s.costUsd)}</TableCell>
                  <TableCell className="text-right">
                    {usd(s.costPerLearnerUsd)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section title={t("byTask")}>
          {usageTable(data.byTask, t("task"), (key) => (
            <>
              {key}
              {key && essential.has(key) && (
                <Badge variant="outline" className="ml-2 font-sans">
                  {t("essential")}
                </Badge>
              )}
            </>
          ))}
        </Section>
        <Section title={t("byModel")}>
          {usageTable(data.byModel, t("model"), (key) => key)}
        </Section>
      </div>

      <Section title={t("byOrganization")}>
        {data.byOrganization.length === 0 ? (
          <EmptyState>{t("noData")}</EmptyState>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("organization")}</TableHead>
                <TableHead className="text-right">{t("calls")}</TableHead>
                <TableHead className="text-right">{t("cost")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.byOrganization.map((o) => (
                <TableRow key={o.organizationId ?? "none"}>
                  <TableCell>
                    {o.organizationName ?? t("noOrganization")}
                  </TableCell>
                  <TableCell className="text-right">
                    {format.number(o.calls)}
                  </TableCell>
                  <TableCell className="text-right">{usd(o.costUsd)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>
    </>
  );
}
