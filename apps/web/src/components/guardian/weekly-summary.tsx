import { Sparkline } from "@wema/ui/components/charts/sparkline";
import { Badge } from "@wema/ui/components/ui/badge";
import { useFormatter, useTranslations } from "next-intl";
import type { ChildSummary } from "../../lib/guardian-types";

type Week = Pick<
  ChildSummary,
  "week" | "lastActivityAt" | "subjects" | "nextSteps"
>;

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

/** Résumé des sept derniers jours : mini-courbe des réponses par jour et phrases factuelles. */
export function WeeklySummary({ child }: { child: Week }) {
  const t = useTranslations("guardian.week");
  const format = useFormatter();
  const sentences = useWeeklySentences()(child);
  const values = child.week.days.map((d) => d.answers);
  const chartLabel = t("chartLabel", {
    days: child.week.days
      .map(
        (d) =>
          `${format.dateTime(new Date(`${d.date}T12:00:00Z`), { weekday: "long" })} ${d.answers}`,
      )
      .join(", "),
  });
  return (
    <div
      data-testid="weekly-summary"
      className="flex flex-col gap-3 rounded-card border bg-card p-4 sm:flex-row sm:items-center sm:gap-5"
    >
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
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {sentences.map((s) => (
          <p key={s} className="text-sm text-pretty">
            {s}
          </p>
        ))}
        {child.subjects.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label={t("subjects")}>
            {child.subjects.map((s) => (
              <li key={s}>
                <Badge variant="neutral">{s}</Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
