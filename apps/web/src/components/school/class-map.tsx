import { cn } from "@wema/ui/lib/utils";
import { useFormatter, useTranslations } from "next-intl";
import {
  type ClassMap,
  NOTION_STATUSES,
  type NotionStatusKey,
} from "../../lib/school-types";

const TONE: Record<NotionStatusKey, string> = {
  not_seen: "bg-muted",
  needs_work: "bg-peach",
  in_progress: "bg-butter",
  mastered: "bg-primary",
};

function Legend() {
  const t = useTranslations("school.status");
  return (
    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
      {NOTION_STATUSES.map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5">
          <span className={cn("size-3 rounded-sm border", TONE[s])} />
          {t(s)}
        </span>
      ))}
    </div>
  );
}

/** Carte de la classe : chaque notion du programme, et chaque élève sur chaque notion. */
export function ClassMapView({ map }: { map: ClassMap }) {
  const t = useTranslations("school.map");
  const ts = useTranslations("school.status");
  const format = useFormatter();
  if (map.notions.length === 0)
    return <p className="text-sm text-muted-foreground">{t("noProgram")}</p>;

  return (
    <div className="space-y-6">
      <Legend />
      <div className="space-y-3">
        <h3 className="font-medium">{t("byNotion")}</h3>
        <ul className="space-y-3">
          {map.notions.map((n) => {
            const total =
              n.counts.not_seen +
              n.counts.needs_work +
              n.counts.in_progress +
              n.counts.mastered;
            return (
              <li key={n.notionId} className="space-y-1.5">
                <div className="flex flex-wrap justify-between gap-2 text-sm">
                  <span>{n.name}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {t("masteredOf", { count: n.counts.mastered, total })}
                  </span>
                </div>
                <div
                  className="flex h-2.5 overflow-hidden rounded-full border"
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
                          className={TONE[s]}
                          style={{ width: `${(n.counts[s] / total) * 100}%` }}
                        />
                      ) : null,
                    )}
                </div>
                {n.topMisconceptions.length > 0 && (
                  <ul className="text-xs text-muted-foreground">
                    {n.topMisconceptions.map((m) => (
                      <li key={m.misconceptionId}>
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
        <h3 className="font-medium">{t("byLearner")}</h3>
        {map.learners.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noLearner")}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="p-2 font-medium">{t("learner")}</th>
                  <th className="p-2 font-medium">{t("notions")}</th>
                  <th className="p-2 font-medium">{t("lastActivity")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {map.learners.map((l) => (
                  <tr key={l.userId}>
                    <td className="p-2 font-medium whitespace-nowrap">
                      {l.displayName}
                      {l.activeMisconceptions > 0 && (
                        <span className="block text-xs font-normal text-muted-foreground">
                          {t("activeMisconceptions", {
                            count: l.activeMisconceptions,
                          })}
                        </span>
                      )}
                    </td>
                    <td className="p-2">
                      <div className="flex flex-wrap gap-1">
                        {map.notions.map((n) => {
                          const s = l.statuses[n.notionId] ?? "not_seen";
                          return (
                            <span
                              key={n.notionId}
                              title={`${n.name} : ${ts(s)}`}
                              role="img"
                              aria-label={`${n.name} : ${ts(s)}`}
                              className={cn(
                                "size-4 rounded-sm border",
                                TONE[s],
                              )}
                            />
                          );
                        })}
                      </div>
                    </td>
                    <td className="p-2 whitespace-nowrap text-muted-foreground">
                      {l.lastActivityAt
                        ? format.relativeTime(new Date(l.lastActivityAt))
                        : t("never")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
