import { BookOpenText, Lightbulb, Microphone } from "@phosphor-icons/react/ssr";
import { GlowTile, type GlowTone } from "@wema/ui/components/brand/glow-tile";
import { Progress } from "@wema/ui/components/ui/progress";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import {
  NOTION_STATUS_TONES,
  NOTION_STATUSES,
  NotionStatus,
} from "@wema/ui/components/wema/notion-status";
import { cn } from "@wema/ui/lib/utils";
import { useTranslations } from "next-intl";
import type { ProfileNotion } from "../../lib/guardian-types";

const SUBJECT_TONES: GlowTone[] = ["yellow", "sky", "mint", "rose", "amber"];

/** Progression par notion, regroupée par matière, avec ce qui la justifie. */
export function NotionProgress({ notions }: { notions: ProfileNotion[] }) {
  const t = useTranslations("guardian.profile");
  const tStatus = useTranslations("guardian.status");
  if (notions.length === 0)
    return (
      <EmptyState
        variant="inline"
        icon={<BookOpenText weight="bold" />}
        tone="yellow"
        title={t("noNotions")}
        titleAs="p"
      />
    );
  const subjects = new Map<string, ProfileNotion[]>();
  for (const n of notions) {
    const key = n.subject ?? t("otherSubject");
    subjects.set(key, [...(subjects.get(key) ?? []), n]);
  }
  return (
    <div className="flex flex-col gap-4">
      {[...subjects.entries()].map(([subject, list], i) => {
        const mastered = list.filter((n) => n.status === "mastered").length;
        return (
          <article
            key={subject}
            className="flex flex-col overflow-hidden rounded-card border bg-background/60"
          >
            <header className="flex flex-wrap items-center gap-3 border-b bg-card px-4 py-3">
              <GlowTile
                tone={SUBJECT_TONES[i % SUBJECT_TONES.length] ?? "yellow"}
                size={32}
              >
                <BookOpenText weight="bold" />
              </GlowTile>
              <h3 className="min-w-0 flex-1 font-medium">{subject}</h3>
              <p className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase tabular-nums">
                {t("subjectMastered", { mastered, total: list.length })}
              </p>
              <div
                aria-hidden
                className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full sm:w-40"
              >
                {NOTION_STATUSES.map((s) => {
                  const count = list.filter((n) => n.status === s).length;
                  return count > 0 ? (
                    <span
                      key={s}
                      className={cn(
                        "h-full rounded-full ring-1 ring-foreground/10 ring-inset",
                        NOTION_STATUS_TONES[s].cell,
                      )}
                      style={{ width: `${(count / list.length) * 100}%` }}
                    />
                  ) : null;
                })}
              </div>
            </header>
            <ul className="divide-y">
              {list.map((n) => {
                const total = n.recentAnswers.length;
                const correct = n.recentAnswers.filter((a) => a.correct).length;
                const rate =
                  total > 0 ? Math.round((correct / total) * 100) : 0;
                return (
                  <li key={n.notionId} className="flex flex-col gap-3 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">
                        {n.name ?? t("unknownNotion")}
                      </span>
                      <NotionStatus
                        status={n.status}
                        label={tStatus(n.status)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>
                          {t("answers", { count: n.observations })}
                          {total > 0 && ` · ${t("recent", { correct, total })}`}
                        </span>
                        {total > 0 ? (
                          <span className="font-mono tabular-nums">
                            {rate} %
                          </span>
                        ) : null}
                      </div>
                      {total > 0 ? (
                        <Progress
                          value={Math.max(rate, 2)}
                          aria-label={t("recentRate")}
                          indicatorClassName={NOTION_STATUS_TONES[n.status].dot}
                        />
                      ) : null}
                    </div>
                    {n.misconceptions.length > 0 && (
                      <div className="flex flex-col gap-2 rounded-[10px] bg-warning-soft p-3 text-sm text-warning-text">
                        <p className="flex items-center gap-2 font-medium">
                          <Lightbulb
                            aria-hidden
                            weight="bold"
                            className="size-4"
                          />
                          {t("misconceptions")}
                        </p>
                        <ul className="flex flex-col gap-1 pl-6">
                          {n.misconceptions.map((m) => (
                            <li key={m.misconceptionId} className="list-disc">
                              {m.description ?? t("unknownMisconception")}{" "}
                              <span className="opacity-75">
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
                        className="flex gap-2 rounded-[10px] bg-info-soft p-3 text-sm text-info-text"
                      >
                        <Microphone
                          aria-hidden
                          weight="bold"
                          className="mt-0.5 size-4 shrink-0"
                        />
                        <span>
                          <span className="font-medium">
                            {t(`assessment.${a.kind}`)}
                          </span>{" "}
                          {a.summary}{" "}
                          <span className="opacity-75">
                            {t("assessmentConfidence", {
                              value: Math.round(a.confidence * 100),
                            })}
                          </span>
                        </span>
                      </p>
                    ))}
                  </li>
                );
              })}
            </ul>
          </article>
        );
      })}
    </div>
  );
}
