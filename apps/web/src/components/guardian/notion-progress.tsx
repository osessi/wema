import { useTranslations } from "next-intl";
import type { ProfileNotion } from "../../lib/guardian-types";
import { StatusChip } from "./status-chip";

/** Progression par notion, regroupée par matière, avec ce qui la justifie. */
export function NotionProgress({ notions }: { notions: ProfileNotion[] }) {
  const t = useTranslations("guardian.profile");
  if (notions.length === 0)
    return <p className="text-sm text-muted-foreground">{t("noNotions")}</p>;
  const subjects = new Map<string, ProfileNotion[]>();
  for (const n of notions) {
    const key = n.subject ?? t("otherSubject");
    subjects.set(key, [...(subjects.get(key) ?? []), n]);
  }
  return (
    <div className="space-y-5">
      {[...subjects.entries()].map(([subject, list]) => (
        <div key={subject} className="space-y-2">
          <h3 className="font-medium">{subject}</h3>
          <ul className="divide-y rounded-lg border">
            {list.map((n) => {
              const correct = n.recentAnswers.filter((a) => a.correct).length;
              return (
                <li key={n.notionId} className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">
                      {n.name ?? t("unknownNotion")}
                    </span>
                    <StatusChip status={n.status} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t("answers", { count: n.observations })}
                    {n.recentAnswers.length > 0 &&
                      ` · ${t("recent", { correct, total: n.recentAnswers.length })}`}
                  </p>
                  {n.misconceptions.length > 0 && (
                    <div className="space-y-1 text-sm">
                      <p className="font-medium">{t("misconceptions")}</p>
                      <ul className="list-disc space-y-0.5 pl-5">
                        {n.misconceptions.map((m) => (
                          <li key={m.misconceptionId}>
                            {m.description ?? t("unknownMisconception")}{" "}
                            <span className="text-muted-foreground">
                              {t("seen", { count: m.occurrences })}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {n.assessments.map((a) => (
                    <p
                      key={a.sessionId}
                      className="rounded-md bg-muted p-3 text-sm"
                    >
                      <span className="font-medium">
                        {t(`assessment.${a.kind}`)}
                      </span>{" "}
                      {a.summary}{" "}
                      <span className="text-muted-foreground">
                        {t("assessmentConfidence", {
                          value: Math.round(a.confidence * 100),
                        })}
                      </span>
                    </p>
                  ))}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
