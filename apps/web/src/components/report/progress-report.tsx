import {
  Brain,
  CheckCircle,
  ClockCountdown,
  DownloadSimple,
  Gauge,
  SealCheck,
  Student,
  WarningCircle,
} from "@phosphor-icons/react/ssr";
import type { AppType } from "@wema/api";
import { BarChart, DonutChart } from "@wema/ui/components/charts/index";
import { ILLUSTRATION_FOR } from "@wema/ui/components/illustrations/usages";
import { Button } from "@wema/ui/components/ui/button";
import {
  CARD_INNER_SHADOW,
  Card,
  CardShell,
} from "@wema/ui/components/ui/card";
import { Input } from "@wema/ui/components/ui/input";
import { Label } from "@wema/ui/components/ui/label";
import { NativeSelect } from "@wema/ui/components/ui/native-select";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import { StatTile } from "@wema/ui/components/wema/stat-tile";
import { SubjectIcon } from "@wema/ui/components/wema/subject-icon";
import { cn } from "@wema/ui/lib/utils";
import type { hc } from "hono/client";
import { getTranslations } from "next-intl/server";
import { load } from "../../lib/api-server";
import { SectionTitle } from "../school/section-title";
import { PrintButton } from "./print-button";

type Ok<F> = F extends (...args: never[]) => Promise<infer R>
  ? R extends { ok: true; json(): Promise<infer T> }
    ? T
    : never
  : never;
type Api = ReturnType<typeof hc<AppType>>["api"];
export type ReportBody = Ok<Api["reports"]["classes"][":id"]["$get"]>;

const PRINT_CSS = `@media print {
  @page { margin: 14mm; }
  [data-slot="sidebar-gap"], [data-slot="sidebar-container"],
  [data-slot="sidebar-inset"] > header, [data-slot="sidebar-inset"] > footer { display: none !important; }
  [data-slot="sidebar-inset"] { margin: 0 !important; border: 0 !important; box-shadow: none !important; }
  [data-slot="sidebar-inset"] > div { padding: 0 !important; }
  html, body { background: #fff !important; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}`;

const STATUSES = ["not_seen", "needs_work", "in_progress", "mastered"] as const;
const STATUS_TONE = {
  not_seen: "slate",
  needs_work: "rose",
  in_progress: "yellow",
  mastered: "mint",
} as const;
/** À l'impression : pas de coque, et une section ne se coupe pas. */
const SHELL_PRINT =
  "print:break-inside-avoid print:border-0 print:bg-none print:p-0 print:shadow-none";

/** Paramètres d'adresse du rapport : ?classe=…&du=AAAA-MM-JJ&au=AAAA-MM-JJ. */
export interface ReportQuery {
  classe?: string | undefined;
  du?: string | undefined;
  au?: string | undefined;
}

const isDay = (v: string | undefined) =>
  v !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;

/** Requête vers l'API : seulement des dates bien formées. */
export function reportApiQuery(q: ReportQuery) {
  const from = isDay(q.du);
  const to = isDay(q.au);
  return {
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  };
}

/** Lit le rapport ; une période refusée (à l'envers, trop longue) donne « invalid ». */
export async function readReport<
  R extends { ok: boolean; status: number; json(): Promise<unknown> },
>(response: Promise<R>) {
  const res = await response;
  if (res.status === 422) return "invalid" as const;
  return load(Promise.resolve(res));
}

const day = (iso: string) => iso.slice(0, 10);
const frDate = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(iso));

/** Choix de la classe et de la période (formulaire GET, sans JavaScript). */
export async function ReportFilters({
  classes,
  query,
  report,
}: {
  classes: readonly { id: string; name: string }[];
  query: ReportQuery;
  report: ReportBody | null;
}) {
  const t = await getTranslations("reports.report");
  return (
    <CardShell className="print:hidden">
      <form
        method="get"
        className={cn(
          "flex flex-wrap items-end gap-3 rounded-card border bg-card p-4",
          CARD_INNER_SHADOW,
        )}
      >
        <div className="grid min-w-48 flex-1 gap-1.5">
          <Label htmlFor="report-class">{t("class")}</Label>
          <NativeSelect
            id="report-class"
            name="classe"
            defaultValue={query.classe ?? classes[0]?.id}
          >
            {classes.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="report-from">{t("from")}</Label>
          <Input
            id="report-from"
            name="du"
            type="date"
            defaultValue={report ? day(report.report.from) : isDay(query.du)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="report-to">{t("to")}</Label>
          <Input
            id="report-to"
            name="au"
            type="date"
            defaultValue={report ? day(report.report.to) : isDay(query.au)}
          />
        </div>
        <Button type="submit" variant="brand">
          {t("show")}
        </Button>
      </form>
    </CardShell>
  );
}

function duration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} h ${String(m).padStart(2, "0")} min` : `${m} min`;
}

/** Rapport de progression d'une classe : uniquement les chiffres du journal. */
export async function ProgressReportView({ data }: { data: ReportBody }) {
  const t = await getTranslations("reports.report");
  const r = data.report;
  const pct = (v: number | null) =>
    v === null ? "—" : `${Math.round(v * 100)} %`;
  const endCells = STATUSES.reduce((sum, s) => sum + r.statuses.end[s], 0);
  const csv = `/api/reports/classes/${data.classId}/csv?from=${day(r.from)}&to=${day(r.to)}`;

  if (r.learners.enrolled === 0 || r.notions === 0)
    return (
      <EmptyState
        icon={<Student weight="fill" />}
        tone="sky"
        title={r.notions === 0 ? t("noProgram") : t("noLearners")}
        description={t("emptyHint")}
      />
    );

  return (
    <article className="space-y-6" aria-labelledby="report-title">
      {/* Version imprimable : seul le rapport, sans le cadre de l'application. */}
      <style>{PRINT_CSS}</style>
      <Card
        tone="brand"
        shellClassName="print:border-0 print:bg-none print:p-0 print:shadow-none"
        className="flex-row flex-wrap items-start justify-between gap-4 p-4 sm:p-6 print:border-0 print:p-0 print:shadow-none"
      >
        <header className="flex min-w-0 items-start gap-4">
          <SubjectIcon icon={data.subjectIcon} size={48} />
          <div className="min-w-0 space-y-1">
            <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
              {t("eyebrow")}
            </p>
            <h2 id="report-title" className="text-xl font-semibold">
              {data.className}
            </h2>
            {data.program ? (
              <p className="text-sm text-muted-foreground">{data.program}</p>
            ) : null}
            <p className="text-sm">
              {t("period", { from: frDate(r.from), to: frDate(r.to) })}
            </p>
          </div>
        </header>
        <div className="flex flex-wrap gap-2 print:hidden">
          <PrintButton label={t("print")} />
          <Button asChild variant="outline">
            <a href={csv} download>
              <DownloadSimple aria-hidden />
              {t("csv")}
            </a>
          </Button>
        </div>
      </Card>

      <section
        aria-label={t("keyFigures")}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4"
      >
        <StatTile
          label={t("activeLearners")}
          value={r.learners.active}
          hint={t("ofEnrolled", { count: r.learners.enrolled })}
          icon={<Student weight="fill" />}
          tone="sky"
        />
        <StatTile
          label={t("validated")}
          value={r.validated.end}
          hint={t("validatedHint", { start: r.validated.start })}
          delta={{
            value: r.validated.end - r.validated.start,
            goodWhen: "up",
            label: t("sinceStart"),
          }}
          icon={<CheckCircle weight="fill" />}
          tone="mint"
        />
        <StatTile
          label={t("mastery")}
          value={pct(r.mastery.end)}
          hint={
            r.mastery.pairs === 0
              ? t("masteryNone")
              : t("masteryHint", {
                  start: pct(r.mastery.start),
                  pairs: r.mastery.pairs,
                })
          }
          {...(r.mastery.change === null
            ? {}
            : {
                delta: {
                  value: Math.round(r.mastery.change * 100),
                  goodWhen: "up" as const,
                  label: t("points"),
                },
              })}
          icon={<Gauge weight="fill" />}
          tone="yellow"
        />
        <StatTile
          label={t("activity")}
          value={duration(r.activity.minutes)}
          hint={t("activityHint", {
            sessions: r.activity.sessions,
            days: r.activity.activeDays,
          })}
          icon={<ClockCountdown weight="fill" />}
          tone="amber"
        />
      </section>

      <Card
        tone="mint"
        shellClassName={SHELL_PRINT}
        className="gap-5 p-4 sm:p-6"
      >
        <SectionTitle
          title={t("statusTitle")}
          description={t("statusHint", { notions: r.notions })}
          icon={<Gauge weight="fill" />}
          tone="mint"
        />
        <div className="grid items-center gap-6 lg:grid-cols-[18rem_minmax(0,1fr)] print:grid-cols-[14rem_minmax(0,1fr)]">
          <DonutChart
            label={t("statusEnd")}
            data={STATUSES.map((s) => ({
              name: t(`status.${s}`),
              value: r.statuses.end[s],
              tone: STATUS_TONE[s],
            }))}
            centerValue={`${endCells > 0 ? Math.round((r.statuses.end.mastered / endCells) * 100) : 0} %`}
            centerLabel={t("validatedShort")}
          />
          <BarChart
            data={STATUSES.map((s) => ({
              status: t(`status.${s}`),
              start: r.statuses.start[s],
              end: r.statuses.end[s],
            }))}
            x="status"
            label={t("statusTitle")}
            integer
            series={[
              { key: "start", label: t("start"), tone: "slate" },
              { key: "end", label: t("end"), tone: "mint" },
            ]}
            className="h-64 print:h-56"
          />
        </div>
        <table className="w-full text-sm">
          <caption className="sr-only">{t("statusTitle")}</caption>
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th scope="col" className="py-2 font-medium">
                {t("statusCol")}
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                {t("start")}
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                {t("end")}
              </th>
            </tr>
          </thead>
          <tbody>
            {STATUSES.map((s) => (
              <tr key={s} className="border-b last:border-0">
                <th scope="row" className="py-2 text-left font-normal">
                  {t(`status.${s}`)}
                </th>
                <td className="py-2 text-right tabular-nums">
                  {r.statuses.start[s]}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {r.statuses.end[s]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card
        tone="sky"
        shellClassName={SHELL_PRINT}
        className="gap-5 p-4 sm:p-6"
      >
        <SectionTitle
          title={t("topTitle")}
          icon={<Brain weight="fill" />}
          tone="sky"
        />
        {r.topNotions.length === 0 ? (
          <EmptyState
            variant="inline"
            illustration={ILLUSTRATION_FOR.diagnostic}
            titleAs="p"
            title={t("topNone")}
          />
        ) : (
          <>
            <BarChart
              data={r.topNotions.map((n) => ({
                notion: n.name,
                answers: n.answers,
                correct: n.correct,
              }))}
              x="notion"
              layout="horizontal"
              label={t("topTitle")}
              integer
              series={[
                { key: "answers", label: t("answers"), tone: "sky" },
                { key: "correct", label: t("correct"), tone: "mint" },
              ]}
              className="h-72 print:h-60"
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[28rem] text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th scope="col" className="py-2 font-medium">
                      {t("notion")}
                    </th>
                    <th scope="col" className="py-2 text-right font-medium">
                      {t("answers")}
                    </th>
                    <th scope="col" className="py-2 text-right font-medium">
                      {t("correct")}
                    </th>
                    <th scope="col" className="py-2 text-right font-medium">
                      {t("learners")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {r.topNotions.map((n) => (
                    <tr key={n.notionId} className="border-b last:border-0">
                      <th scope="row" className="py-2 text-left font-normal">
                        {n.name}
                      </th>
                      <td className="py-2 text-right tabular-nums">
                        {n.answers}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {n.correct}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {n.learners}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      <Card
        tone="rose"
        shellClassName={SHELL_PRINT}
        className="gap-5 p-4 sm:p-6"
      >
        <SectionTitle
          title={t("misTitle")}
          description={t("misHint")}
          icon={<WarningCircle weight="fill" />}
          tone="rose"
        />
        {r.misconceptions.length === 0 ? (
          <EmptyState
            variant="inline"
            icon={<SealCheck weight="fill" />}
            tone="mint"
            titleAs="p"
            title={t("misNone")}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th scope="col" className="py-2 font-medium">
                    {t("misconception")}
                  </th>
                  <th scope="col" className="py-2 text-right font-medium">
                    {t("occurrences")}
                  </th>
                  <th scope="col" className="py-2 text-right font-medium">
                    {t("evolution")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {r.misconceptions.map((m) => (
                  <tr
                    key={m.misconceptionId}
                    className="border-b last:border-0"
                  >
                    <th scope="row" className="py-2 text-left font-normal">
                      <span className="block">{m.description}</span>
                      <span className="block text-xs text-muted-foreground">
                        {m.notionName}
                      </span>
                    </th>
                    <td className="py-2 text-right tabular-nums">
                      {m.occurrences}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {t("evolutionValue", {
                        start: m.learnersStart,
                        end: m.learnersEnd,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="text-xs text-muted-foreground">{t("method")}</p>
    </article>
  );
}
