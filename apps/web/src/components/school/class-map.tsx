import { Lightbulb, MapTrifold, Student } from "@phosphor-icons/react/ssr";
import { Badge } from "@wema/ui/components/ui/badge";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import { NotionHeatmap } from "@wema/ui/components/wema/notion-heatmap";
import {
  NOTION_STATUS_TONES,
  NotionStatusLegend,
} from "@wema/ui/components/wema/notion-status";
import { cn } from "@wema/ui/lib/utils";
import { useFormatter, useTranslations } from "next-intl";
import { type ClassMap, NOTION_STATUSES } from "../../lib/school-types";

/** Carte de la classe : chaque notion du programme, et chaque élève sur chaque notion. */
export function ClassMapView({ map }: { map: ClassMap }) {
  const t = useTranslations("school.map");
  const ts = useTranslations("school.status");
  const format = useFormatter();
  const statusLabels = {
    not_seen: ts("not_seen"),
    needs_work: ts("needs_work"),
    in_progress: ts("in_progress"),
    mastered: ts("mastered"),
  };
  if (map.notions.length === 0)
    return (
      <EmptyState
        variant="inline"
        icon={<MapTrifold weight="fill" />}
        title={t("noProgram")}
      />
    );

  return (
    <div className="space-y-8">
      <NotionStatusLegend labels={statusLabels} />
      <div className="space-y-3">
        <h3 className="font-mono text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
          {t("byNotion")}
        </h3>
        <ul className="grid gap-3 lg:grid-cols-2">
          {map.notions.map((n) => {
            const total =
              n.counts.not_seen +
              n.counts.needs_work +
              n.counts.in_progress +
              n.counts.mastered;
            return (
              <li
                key={n.notionId}
                className="flex h-full flex-col gap-3 rounded-card border bg-background/60 p-4"
              >
                <div className="flex items-start justify-between gap-3 text-sm">
                  <span className="min-w-0 font-medium">{n.name}</span>
                  <Badge
                    variant={
                      total > 0 && n.counts.mastered === total
                        ? "success"
                        : "neutral"
                    }
                    className="tabular-nums"
                  >
                    {t("masteredOf", { count: n.counts.mastered, total })}
                  </Badge>
                </div>
                <div
                  className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-muted"
                  role="img"
                  aria-label={NOTION_STATUSES.map(
                    (s) => `${ts(s)} : ${n.counts[s]}`,
                  ).join(", ")}
                >
                  {total > 0 &&
                    NOTION_STATUSES.map((s) =>
                      n.counts[s] > 0 ? (
                        <span
                          key={s}
                          className={cn(
                            "h-full first:rounded-l-full last:rounded-r-full",
                            s === "not_seen"
                              ? "bg-status-not-seen-ink/25"
                              : NOTION_STATUS_TONES[s].dot,
                          )}
                          style={{ width: `${(n.counts[s] / total) * 100}%` }}
                        />
                      ) : null,
                    )}
                </div>
                <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {NOTION_STATUSES.filter((s) => n.counts[s] > 0).map((s) => (
                    <li key={s} className="inline-flex items-center gap-1.5">
                      <span
                        aria-hidden
                        className={cn(
                          "size-1.5 rounded-full",
                          NOTION_STATUS_TONES[s].dot,
                        )}
                      />
                      {ts(s)}{" "}
                      <span className="tabular-nums">{n.counts[s]}</span>
                    </li>
                  ))}
                </ul>
                {n.topMisconceptions.length > 0 && (
                  <ul className="mt-auto space-y-1 border-t pt-3 text-xs text-muted-foreground">
                    {n.topMisconceptions.map((m) => (
                      <li
                        key={m.misconceptionId}
                        className="flex items-start gap-1.5"
                      >
                        <Lightbulb
                          aria-hidden
                          weight="fill"
                          className="mt-0.5 size-3 shrink-0 text-warning-text"
                        />
                        {t("misconception", {
                          description: m.description ?? t("unknown"),
                          count: m.learners,
                        })}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      <div className="space-y-3">
        <h3 className="font-mono text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
          {t("byLearner")}
        </h3>
        {map.learners.length === 0 ? (
          <EmptyState
            variant="inline"
            icon={<Student weight="fill" />}
            tone="mint"
            title={t("noLearner")}
          />
        ) : (
          <>
            <NotionHeatmap
              caption={t("byLearner")}
              learnerHeader={t("learner")}
              notions={map.notions.map((n) => ({
                id: n.notionId,
                name: n.name,
              }))}
              learners={map.learners.map((l) => ({
                id: l.userId,
                name: l.displayName,
                statuses: l.statuses,
              }))}
              statusLabels={statusLabels}
              legend={false}
            />
            {/* Pas de liste : la fiche garde un seul élément de liste par élève (e2e). */}
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {map.learners.map((l) => (
                <div
                  key={l.userId}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-background/60 px-3 py-2 text-sm"
                >
                  <span className="min-w-0 truncate font-medium">
                    {l.displayName}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {l.activeMisconceptions > 0 && (
                      <Badge variant="warning" className="tabular-nums">
                        {t("activeMisconceptions", {
                          count: l.activeMisconceptions,
                        })}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {l.lastActivityAt
                        ? format.relativeTime(new Date(l.lastActivityAt))
                        : t("never")}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
