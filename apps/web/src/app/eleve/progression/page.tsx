import { ArrowRight, MapPin, Path, Star } from "@phosphor-icons/react/ssr";
import { DonutChart } from "@wema/ui/components/charts/index";
import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import {
  CARD_INNER_SHADOW,
  Card,
  CardContent,
  CardHeader,
  CardShell,
  CardTitle,
  cardShellVariants,
  SHELL_TONE_FOR_GLOW,
} from "@wema/ui/components/ui/card";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import {
  NOTION_STATUS_TONES,
  NOTION_STATUSES,
  NotionStatus,
} from "@wema/ui/components/wema/notion-status";
import { ProgressRing } from "@wema/ui/components/wema/progress-ring";
import {
  SUBJECT_ICON_GLYPHS,
  SubjectIcon,
} from "@wema/ui/components/wema/subject-icon";
import { cn } from "@wema/ui/lib/utils";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "../../../components/page-header";
import { load, serverApi } from "../../../lib/api-server";
import type { PathNotion } from "../../../lib/learner-types";

/** Ton de l'anneau pour chaque statut de notion. */
const STATUS_CHART_TONE = {
  mastered: "mint",
  in_progress: "yellow",
  needs_work: "rose",
  not_seen: "slate",
} as const;

/** Teinte de coque assortie à l'icône de la matière (papier si inconnue). */
function subjectShell(icon: string | null | undefined) {
  const entry = Object.entries(SUBJECT_ICON_GLYPHS).find(([k]) => k === icon);
  return entry ? SHELL_TONE_FOR_GLOW[entry[1].tone] : "neutral";
}

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
          <section
            key={k.key}
            className="grid items-start gap-6 lg:grid-cols-[minmax(0,42rem)_minmax(0,20rem)]"
          >
            <div className="min-w-0 space-y-5">
              <CardShell tone={subjectShell(k.subjectIcon)}>
                <div
                  className={cn(
                    "flex items-center justify-between gap-4 rounded-card border bg-card p-4 sm:p-5",
                    CARD_INNER_SHADOW,
                  )}
                >
                  <SubjectIcon icon={k.subjectIcon} size={48} />
                  <div className="min-w-0 flex-1 space-y-1">
                    <h2 className="font-mono text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                      {k.name}
                    </h2>
                    <p className="text-2xl font-medium tracking-tight tabular-nums">
                      {t("progress.counter", {
                        mastered,
                        total: k.notions.length,
                      })}
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
              </CardShell>
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
                            "min-w-0 flex-1",
                            isHere
                              ? cardShellVariants({ tone: "brand" })
                              : "p-0",
                          )}
                        >
                          <div
                            className={cn(
                              "space-y-2 rounded-card border bg-card p-4",
                              isHere ? CARD_INNER_SHADOW : "shadow-xs",
                              done && "bg-status-mastered/40",
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
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
            {k.notions.length > 0 && (
              <Card tone="neutral" className="gap-4 lg:sticky lg:top-6">
                <CardHeader>
                  <CardTitle>{t("progress.breakdown")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <DonutChart
                    label={t("progress.breakdown")}
                    summary={t("progress.counter", {
                      mastered,
                      total: k.notions.length,
                    })}
                    data={NOTION_STATUSES.map((st) => ({
                      name: t(`status.${st}`),
                      value: k.notions.filter((n) => n.status === st).length,
                      tone: STATUS_CHART_TONE[st],
                    }))}
                    centerValue={`${mastered}/${k.notions.length}`}
                    centerLabel={t("home.ringCaption")}
                    className="*:w-full"
                  />
                </CardContent>
              </Card>
            )}
          </section>
        );
      })}
    </>
  );
}
