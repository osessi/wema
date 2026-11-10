import { CalendarX, ChalkboardTeacher } from "@phosphor-icons/react/ssr";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "../../../components/page-header";
import {
  ProgressReportView,
  ReportFilters,
  type ReportQuery,
  readReport,
  reportApiQuery,
} from "../../../components/report/progress-report";
import { serverApi } from "../../../lib/api-server";
import { getSpaces } from "../../../lib/spaces";

/** Rapport de progression d'une des classes du prof (pilote). */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<ReportQuery>;
}) {
  const query = await searchParams;
  const t = await getTranslations("reports.report");
  const { mine } = await getSpaces();
  const classes = mine.teaching;
  const selected = classes.find((k) => k.id === query.classe) ?? classes[0];
  const api = await serverApi();
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
            classes={classes}
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
          icon={<ChalkboardTeacher weight="fill" />}
          tone="sky"
          title={t("noClasses")}
        />
      )}
    </div>
  );
}
