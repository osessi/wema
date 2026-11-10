import { CalendarX } from "@phosphor-icons/react/ssr";
import { ILLUSTRATION_FOR } from "@wema/ui/components/illustrations/usages";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "../../../../components/page-header";
import {
  ProgressReportView,
  ReportFilters,
  type ReportQuery,
  readReport,
  reportApiQuery,
} from "../../../../components/report/progress-report";
import { getSchool } from "../../../../components/school/school-context";
import { load, serverApi } from "../../../../lib/api-server";

/** Rapport de progression d'une classe de l'école (pilote). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<ReportQuery>;
}) {
  const { orgId } = await params;
  const query = await searchParams;
  const { can } = await getSchool(orgId);
  if (!can("classes.manage")) notFound();
  const t = await getTranslations("reports.report");
  const api = await serverApi();
  const { classes } = await load(
    api.admin.organizations[":id"].classes.$get({ param: { id: orgId } }),
  );
  const live = classes.filter((k) => !k.archived);
  const selected = live.find((k) => k.id === query.classe) ?? live[0];
  const result = selected
    ? await readReport(
        api.reports.classes[":id"].$get({
          param: { id: selected.id },
          query: reportApiQuery(query),
        }),
      )
    : null;
  const data = result === "invalid" ? null : result;

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      {selected ? (
        <>
          <ReportFilters
            classes={live}
            query={{ ...query, classe: selected.id }}
            report={data}
          />
          {result === "invalid" ? (
            <EmptyState
              icon={<CalendarX weight="fill" />}
              tone="amber"
              title={t("invalidPeriod")}
            />
          ) : data ? (
            <ProgressReportView data={data} />
          ) : null}
        </>
      ) : (
        <EmptyState
          illustration={ILLUSTRATION_FOR.emptyClasses}
          titleAs="h2"
          title={t("noClasses")}
        />
      )}
    </div>
  );
}
