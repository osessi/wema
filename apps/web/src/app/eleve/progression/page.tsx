import { ArrowRight, MapPin, Path, Star } from "@phosphor-icons/react/ssr";
import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import {
  NOTION_STATUS_TONES,
  NotionStatus,
} from "@wema/ui/components/wema/notion-status";
import { ProgressRing } from "@wema/ui/components/wema/progress-ring";
import { cn } from "@wema/ui/lib/utils";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "../../../components/page-header";
import { load, serverApi } from "../../../lib/api-server";
import type { PathNotion } from "../../../lib/learner-types";

/** Notion où se trouve l'élève : celle de sa prochaine action, sinon la première non validée. */
function hereOf(notions: PathNotion[], suggested: Set<string>) {
  return (
    notions.find((n) => suggested.has(n.notionId))?.notionId ??
    notions.find((n) => n.status === "in_progress" || n.status === "needs_work")
      ?.notionId ??
    notions.find((n) => n.status === "not_seen")?.notionId ??
    null
  );
}

export default async function Page() {
  const t = await getTranslations("learner");
  const api = await serverApi();
  const [{ classes }, { actions }] = await Promise.all([
    load(api.learner.path.$get()),
    load(api.learner.next.$get()),
  ]);
  const firstNotion = actions.find((a) => "notionId" in a);
  const suggested = new Set(
    firstNotion && "notionId" in firstNotion ? [firstNotion.notionId] : [],
  );

  return (
    <>
      <PageHeader
        title={t("progress.title")}
        description={t("progress.description")}
      />
      {classes.length === 0 && (
        <EmptyState
          icon={<Path weight="fill" />}
          tone="amber"
          title={t("progress.empty")}
          titleAs="h2"
          action={
            <Button asChild variant="outline">
              <Link href="/eleve/prof-ia">{t("progress.emptyAction")}</Link>
            </Button>
          }
        />
      )}
      {classes.map((k) => {
        const here = hereOf(k.notions, suggested);
        const mastered = k.notions.filter(
          (n) => n.status === "mastered",
        ).length;
        return (
          <section key={k.key} className="max-w-2xl space-y-5">
            <div className="flex items-center justify-between gap-4 rounded-card border bg-card p-4 shadow-xs">
              <div className="min-w-0 space-y-1">
                <h2 className="font-mono text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                  {k.name}
                </h2>
                <p className="text-2xl font-medium tracking-tight tabular-nums">
                  {t("progress.counter", { mastered, total: k.notions.length })}
                </p>
              </div>
              {k.notions.length > 0 && (
                <ProgressRing
                  value={mastered}
                  max={k.notions.length}
                  tone="mint"
                  size={56}
                  label={t("progress.classRing", { name: k.name })}
                />
              )}
            </div>
            {k.notions.length === 0 ? (
              <EmptyState
                variant="inline"
                icon={<Path weight="fill" />}
                title={t("progress.emptyClass")}
              />
            ) : (
              <ol className="relative">
                {k.notions.map((n, i) => {
                  const isHere = n.notionId === here;
                  const last = i === k.notions.length - 1;
                  const done = n.status === "mastered";
                  const tone = NOTION_STATUS_TONES[n.status];
                  return (
                    <li key={n.notionId} className="relative flex gap-4 pb-4">
                      {!last && (
                        <span
                          aria-hidden
                          className={cn(
                            "absolute top-12 bottom-1 left-6 -translate-x-1/2 border-l-2",
                            done
                              ? "border-status-mastered-ink/50"
                              : "border-dashed border-border",
                          )}
                        />
                      )}
                      <span className="relative z-10 grid size-12 shrink-0 place-items-center">
                        {isHere && (
                          <span
                            aria-hidden
                            className="absolute inset-0 rounded-full bg-brand/40 motion-safe:animate-ping motion-safe:[animation-duration:2.4s]"
                          />
                        )}
                        <ProgressRing
                          value={Math.round((n.mastery ?? 0) * 100)}
                          size={48}
                          thickness={3}
                          tone={done ? "mint" : "brand"}
                          label={t("progress.ringLabel", { name: n.name })}
                          className="bg-background rounded-full"
                        >
                          <span
                            className={cn(
                              "grid size-9 place-items-center rounded-full font-sans text-sm font-semibold",
                              tone.cell,
                              tone.glyph || "text-muted-foreground",
                              isHere && "bg-brand text-ink-on-brand",
                            )}
                          >
                            {done ? (
                              <Star weight="fill" className="size-4" />
                            ) : (
                              i + 1
                            )}
                          </span>
                        </ProgressRing>
                      </span>
                      <div
                        className={cn(
                          "min-w-0 flex-1 space-y-2 rounded-card border bg-card p-4 shadow-xs",
                          isHere &&
                            "border-brand shadow-[0_0_0_1px_var(--brand)]",
                        )}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium">{n.name}</p>
                          {isHere && (
                            <Badge variant="brand">
                              <MapPin aria-hidden weight="fill" />
                              {t("progress.here")}
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
                          <NotionStatus
                            status={n.status}
                            label={t(`status.${n.status}`)}
                          />
                          {n.mastery !== null && (
                            <span className="tabular-nums">
                              {t("progress.mastery", {
                                value: Math.round(n.mastery * 100),
                              })}
                            </span>
                          )}
                          <span className="tabular-nums">
                            {t("progress.observations", {
                              count: n.observations,
                            })}
                          </span>
                        </div>
                        {!done && (
                          <Button
                            asChild
                            size="xs"
                            variant={isHere ? "default" : "outline"}
                          >
                            <Link
                              href={`/eleve/prof-ia?mode=course_question&notion=${n.notionId}`}
                            >
                              {t("progress.work")}
                              <ArrowRight aria-hidden />
                            </Link>
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        );
      })}
    </>
  );
}
