import { Check, MapPin } from "@phosphor-icons/react/ssr";
import { cn } from "@wema/ui/lib/utils";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  STATUS_CLASSES,
  StatusBadge,
} from "../../../components/learner/status-badge";
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
        <p className="text-muted-foreground">{t("progress.empty")}</p>
      )}
      {classes.map((k) => {
        const here = hereOf(k.notions, suggested);
        return (
          <section key={k.key} className="space-y-4">
            <h2 className="font-display text-xl font-bold">{k.name}</h2>
            {k.notions.length === 0 ? (
              <p className="text-muted-foreground">
                {t("progress.emptyClass")}
              </p>
            ) : (
              <ol className="relative max-w-xl">
                {k.notions.map((n, i) => {
                  const isHere = n.notionId === here;
                  const last = i === k.notions.length - 1;
                  return (
                    <li key={n.notionId} className="relative flex gap-4 pb-6">
                      {!last && (
                        <span
                          aria-hidden
                          className="absolute top-10 bottom-0 left-5 w-0.5 -translate-x-1/2 bg-border"
                        />
                      )}
                      <span
                        aria-hidden
                        className={cn(
                          "relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border font-display font-bold",
                          STATUS_CLASSES[n.status],
                          isHere && "ring-4 ring-brand",
                        )}
                      >
                        {n.status === "mastered" ? (
                          <Check weight="bold" />
                        ) : (
                          i + 1
                        )}
                      </span>
                      <div
                        className={cn(
                          "flex-1 space-y-2 rounded-xl border bg-card p-4",
                          isHere && "border-brand",
                        )}
                      >
                        {isHere && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-brand px-2 py-0.5 text-xs font-semibold text-ink-on-brand">
                            <MapPin weight="fill" />
                            {t("progress.here")}
                          </span>
                        )}
                        <p className="font-medium">{n.name}</p>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          <StatusBadge status={n.status} />
                          {n.mastery !== null && (
                            <span>
                              {t("progress.mastery", {
                                value: Math.round(n.mastery * 100),
                              })}
                            </span>
                          )}
                          <span>
                            {t("progress.observations", {
                              count: n.observations,
                            })}
                          </span>
                        </div>
                        {n.status !== "mastered" && (
                          <Link
                            href={`/eleve/prof-ia?mode=course_question&notion=${n.notionId}`}
                            className="text-sm font-medium underline underline-offset-4"
                          >
                            {t("progress.work")}
                          </Link>
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
