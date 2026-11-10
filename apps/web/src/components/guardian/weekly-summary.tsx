import { BarChart } from "@wema/ui/components/charts/bar-chart";
import { Sparkline } from "@wema/ui/components/charts/sparkline";
import { SubjectLabel } from "@wema/ui/components/wema/subject-icon";
import { cn } from "@wema/ui/lib/utils";
import { useFormatter, useTranslations } from "next-intl";
import type { ChildSummary } from "../../lib/guardian-types";

type Week = Pick<
  ChildSummary,
  "week" | "lastActivityAt" | "subjects" | "nextSteps"
> &
  Partial<Pick<ChildSummary, "subjectIcons">>;

/**
 * Phrases du résumé de la semaine, construites uniquement à partir des
 * chiffres du journal (aucune IA, rien d'inventé). Une phrase par fait connu.
 */
export function useWeeklySentences() {
  const t = useTranslations("guardian.week");
  const format = useFormatter();
  const list = (items: readonly string[]) =>
    format.list(items, { type: "conjunction" });
  return ({ week, lastActivityAt, nextSteps }: Week): string[] => {
    const lines: string[] = [];
    if (week.answers === 0)
      lines.push(
        lastActivityAt
          ? t("idleSince", {
              date: format.dateTime(new Date(lastActivityAt), {
                day: "numeric",
                month: "long",
              }),
            })
          : t("never"),
      );
    else
      lines.push(
        t("activity", {
          answers: week.answers,
          days: week.activeDays,
          correct: week.correct,
        }),
      );
    if (week.validated.length > 0)
      lines.push(
        t("validated", {
          count: week.validated.length,
          names: list(week.validated),
        }),
      );
    if (week.reworked.length > 0)
      lines.push(
        t("reworked", {
          count: week.reworked.length,
          names: list(week.reworked),
        }),
      );
    if (nextSteps.length > 0)
      lines.push(
        t("next", { count: nextSteps.length, names: list(nextSteps) }),
      );
    return lines;
  };
}

/**
 * Résumé des sept derniers jours et phrases factuelles. `chart="spark"` :
 * mini-courbe (accueil) ; `chart="bar"` : barres des réponses par jour (fiche).
 */
export function WeeklySummary({
  child,
  chart = "spark",
}: {
  child: Week;
  chart?: "spark" | "bar";
}) {
  const t = useTranslations("guardian.week");
  const format = useFormatter();
  const sentences = useWeeklySentences()(child);
  const values = child.week.days.map((d) => d.answers);
  const day = (date: string, weekday: "long" | "short") =>
    format.dateTime(new Date(`${date}T12:00:00Z`), { weekday });
  const chartLabel = t("chartLabel", {
    days: child.week.days
      .map((d) => `${day(d.date, "long")} ${d.answers}`)
      .join(", "),
  });
  const bar = chart === "bar";
  return (
    <div
      data-testid="weekly-summary"
      className={cn(
        "flex flex-col gap-4",
        bar
          ? ""
          : "rounded-card border bg-card p-4 sm:flex-row sm:items-center sm:gap-5",
      )}
    >
      {bar ? (
        // `relative overflow-hidden` : le tableau sr-only du graphique ne fait pas déborder la page.
        <div className="relative min-w-0 overflow-hidden">
          <BarChart
            label={chartLabel}
            data={child.week.days.map((d) => ({
              jour: day(d.date, "short"),
              reponses: d.answers,
            }))}
            x="jour"
            xLabel={t("dayAxis")}
            series={[
              { key: "reponses", label: t("chartSeries"), tone: "yellow" },
            ]}
            integer
            className="h-48"
          />
        </div>
      ) : (
        <div className="flex shrink-0 flex-col gap-1">
          <Sparkline
            values={values}
            label={chartLabel}
            tone={child.week.answers > 0 ? "yellow" : "slate"}
            width={140}
            height={40}
          />
          <span className="font-mono text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
            {t("chartCaption")}
          </span>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {sentences.map((s) => (
          <p key={s} className="text-sm text-pretty">
            {s}
          </p>
        ))}
        {child.subjects.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label={t("subjects")}>
            {child.subjects.map((s) => (
              <li
                key={s}
                className="rounded-pill border bg-background py-0.5 ps-0.5 pe-2.5 text-xs font-medium"
              >
                <SubjectLabel icon={child.subjectIcons?.[s]} size={20}>
                  {s}
                </SubjectLabel>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
