import {
  ArrowRight,
  CalendarCheck,
  ChatCircleText,
  Confetti,
  Path,
  UsersThree,
} from "@phosphor-icons/react/ssr";
import { GlowTile, TsfFrame } from "@wema/ui/brand";
import { DonutChart } from "@wema/ui/components/charts/index";
import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardShell,
  CardTitle,
  SHELL_TONE_FOR_GLOW,
} from "@wema/ui/components/ui/card";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import {
  NOTION_STATUSES,
  NotionStatus,
} from "@wema/ui/components/wema/notion-status";
import { SubjectLabel } from "@wema/ui/components/wema/subject-icon";
import { cn } from "@wema/ui/lib/utils";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { actionTarget } from "../../components/learner/actions";
import { NudgeReadButton } from "../../components/learner/nudge-read-button";
import { TutorAvatar } from "../../components/learner/tutor-avatar";
import { ACTION_VISUALS } from "../../components/learner/visuals";
import { LearnerFirstSteps } from "../../components/onboarding/learner-first-steps";
import { PageHeader } from "../../components/page-header";
import { load, serverApi } from "../../lib/api-server";
import { getSpaces } from "../../lib/spaces";

const DAY = 24 * 60 * 60 * 1000;

/** Surface intérieure d'une rangée posée dans une coque (`CardShell`). */
const INNER =
  "rounded-card border bg-card shadow-[0_1px_2px_rgb(23_23_20/0.05),0_6px_16px_-10px_rgb(23_23_20/0.18)] dark:shadow-none";

/** Ton de l'anneau pour chaque statut de notion (mêmes tons que les pastilles). */
const STATUS_CHART_TONE = {
  mastered: "mint",
  in_progress: "yellow",
  needs_work: "rose",
  not_seen: "slate",
} as const;

export default async function Page() {
  const t = await getTranslations("learner");
  const tFamily = await getTranslations("family.invite");
  const { session } = await getSpaces();
  // Inscrit seul, sans famille ni école : peut-être un parent (fiche 0010).
  const alone = session.organizations.length === 0;
  const format = await getFormatter();
  const api = await serverApi();
  const [
    { actions },
    { nudges },
    { assignments },
    { classes },
    { current: persona },
  ] = await Promise.all([
    load(api.learner.next.$get()),
    load(api.learner.nudges.$get()),
    load(api.learner.assignments.$get()),
    load(api.learner.path.$get()),
    load(api.learner["tutor-persona"].$get({ query: {} })),
  ]);

  const [first, ...others] = actions;
  const firstTarget = first ? actionTarget(first) : null;
  const FirstIcon = first ? ACTION_VISUALS[first.kind].icon : Confetti;
  const upcoming = assignments
    .filter((a) => a.status === "todo" || a.status === "late")
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
    .slice(0, 4);
  const allDone =
    upcoming.length === 0 &&
    assignments.some((a) => a.status === "done" || a.status === "attempted");
  const unread = nudges.filter((n) => n.status === "ready");
  const notions = classes.flatMap((k) => k.notions);
  const count = (s: string) => notions.filter((n) => n.status === s).length;
  const mastered = count("mastered");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysUntil = (iso: string) => {
    const due = new Date(iso);
    due.setHours(0, 0, 0, 0);
    return Math.round((due.getTime() - today.getTime()) / DAY);
  };

  return (
    <>
      <PageHeader title={t("home.title")} description={t("home.description")} />

      <LearnerFirstSteps />

      {alone && (
        <Card tone="sky">
          <CardHeader>
            <div className="flex items-center gap-3">
              <GlowTile tone="sky" size={40}>
                <UsersThree weight="fill" />
              </GlowTile>
              <div className="space-y-1">
                <CardTitle className="text-lg">{tFamily("title")}</CardTitle>
                <CardDescription>{tFamily("body")}</CardDescription>
              </div>
            </div>
            <CardAction>
              <Button asChild variant="outline">
                <Link href="/famille/creer">{tFamily("action")}</Link>
              </Button>
            </CardAction>
          </CardHeader>
        </Card>
      )}

      <TsfFrame
        className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500"
        innerClassName="bg-[radial-gradient(120%_140%_at_0%_0%,var(--brand-soft)_0%,transparent_60%)] p-6 sm:p-8"
      >
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <GlowTile
            tone={first ? ACTION_VISUALS[first.kind].tone : "mint"}
            size={64}
            idle="breathe"
          >
            <FirstIcon weight="fill" />
          </GlowTile>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="font-mono text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
              {t("home.nextStep")}
            </p>
            <h2 className="text-2xl leading-tight font-medium tracking-tight text-balance sm:text-[28px]">
              {first
                ? `${t(`actions.${first.kind}`)}${first.notionName ? ` · ${first.notionName}` : ""}`
                : t("home.nextEmpty")}
            </h2>
            {first && <p className="text-muted-foreground">{first.reason}</p>}
          </div>
          {first && firstTarget && (
            <Button
              asChild
              variant="bevel"
              size="lg"
              className="w-full sm:w-auto"
            >
              <Link href={firstTarget.href}>
                {t(`actions.go.${firstTarget.label}`)}
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          )}
        </div>
      </TsfFrame>

      <CardShell tone="rose">
        <section
          aria-label={t("persona.homeLabel")}
          className={cn("flex flex-wrap items-center gap-3 p-4", INNER)}
        >
          {persona ? (
            <TutorAvatar
              avatar={persona.avatar}
              name={persona.name}
              size={44}
            />
          ) : (
            <GlowTile tone="rose" size={44}>
              <ChatCircleText weight="fill" />
            </GlowTile>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              {persona
                ? t("persona.homeTitle", { name: persona.name })
                : t("persona.homeEmpty")}
            </p>
            <p className="text-sm text-muted-foreground">
              {persona ? t("persona.homeHint") : t("persona.homeEmptyHint")}
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={persona ? "/eleve/prof-ia" : "/eleve/profil#prof-ia"}>
              {persona
                ? t("persona.homeCta", { name: persona.name })
                : t("persona.homeChoose")}
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </section>
      </CardShell>

      {unread.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium tracking-tight">
            {t("home.nudges")}
          </h2>
          <ul className="space-y-3">
            {unread.map((n) => (
              <li key={n.id}>
                <CardShell tone="rose">
                  <div className={cn("flex items-center gap-3 p-4", INNER)}>
                    <GlowTile tone="rose" size={36}>
                      <ChatCircleText weight="fill" />
                    </GlowTile>
                    <p className="min-w-0 flex-1">{n.content}</p>
                    <NudgeReadButton id={n.id} />
                  </div>
                </CardShell>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card tone="amber" className="h-full">
          <CardHeader>
            <div className="flex items-center gap-3">
              <GlowTile tone="amber" size={36}>
                <CalendarCheck weight="fill" />
              </GlowTile>
              <CardTitle className="text-lg">{t("home.upcoming")}</CardTitle>
            </div>
            <CardAction>
              <Button asChild variant="ghost" size="sm">
                <Link
                  href="/eleve/devoirs"
                  aria-label={t("home.allAssignments")}
                >
                  <span className="hidden sm:inline">
                    {t("home.allAssignments")}
                  </span>
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="flex-1">
            {upcoming.length === 0 ? (
              allDone ? (
                <EmptyState
                  variant="inline"
                  tone="mint"
                  icon={<Confetti weight="fill" />}
                  title={t("home.allDone")}
                  description={t("home.allDoneHint")}
                />
              ) : (
                <EmptyState
                  variant="inline"
                  icon={<CalendarCheck weight="fill" />}
                  title={t("home.noUpcoming")}
                  description={t("home.noUpcomingHint")}
                />
              )
            ) : (
              <ul className="divide-y">
                {upcoming.map((a) => {
                  const days = daysUntil(a.dueAt);
                  const late = a.status === "late" || days < 0;
                  return (
                    <li
                      key={a.id}
                      className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <p className="line-clamp-2 font-medium">{a.title}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant={
                              late
                                ? "danger"
                                : days <= 2
                                  ? "warning"
                                  : "neutral"
                            }
                          >
                            {late
                              ? t("assignmentStatus.late")
                              : t("home.dueIn", { days })}
                          </Badge>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {format.dateTime(new Date(a.dueAt), {
                              day: "numeric",
                              month: "long",
                            })}
                          </span>
                        </div>
                      </div>
                      {a.variantId && (
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/eleve/exercices/${a.variantId}`}>
                            {t("assignments.open")}
                          </Link>
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card tone="mint" className="h-full">
          <CardHeader>
            <div className="flex items-center gap-3">
              <GlowTile tone="mint" size={36}>
                <Path weight="fill" />
              </GlowTile>
              <div className="min-w-0 space-y-1.5">
                <CardTitle className="text-lg">{t("home.progress")}</CardTitle>
                {classes.length > 0 && (
                  <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    {classes.map((k) => (
                      <li key={k.key} className="min-w-0">
                        <SubjectLabel icon={k.subjectIcon} size={20}>
                          {k.name}
                        </SubjectLabel>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <CardAction>
              <Button asChild variant="ghost" size="sm">
                <Link
                  href="/eleve/progression"
                  aria-label={t("home.seeProgress")}
                >
                  <span className="hidden sm:inline">
                    {t("home.seeProgress")}
                  </span>
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="flex-1">
            {notions.length === 0 ? (
              <EmptyState
                variant="inline"
                icon={<Path weight="fill" />}
                title={t("progress.empty")}
              />
            ) : (
              <div className="flex flex-col items-center gap-6 sm:flex-row">
                <DonutChart
                  label={t("home.breakdown")}
                  summary={t("home.ringValue", {
                    mastered,
                    total: notions.length,
                  })}
                  data={NOTION_STATUSES.map((st) => ({
                    name: t(`status.${st}`),
                    value: count(st),
                    tone: STATUS_CHART_TONE[st],
                  }))}
                  legend={false}
                  centerValue={`${mastered}/${notions.length}`}
                  centerLabel={t("home.ringCaption")}
                  className="w-40 shrink-0 *:w-full"
                />
                <ul
                  aria-label={t("home.breakdown")}
                  className="w-full flex-1 space-y-2"
                >
                  {[...NOTION_STATUSES].reverse().map((s) => (
                    <li
                      key={s}
                      className="flex items-center justify-between gap-3"
                    >
                      <NotionStatus status={s} label={t(`status.${s}`)} />
                      <span className="font-mono text-sm tabular-nums">
                        {count(s)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {others.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-mono text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            {t("home.otherActions")}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {others.map((a) => {
              const target = actionTarget(a);
              const { icon: Glyph, tone } = ACTION_VISUALS[a.kind];
              return (
                <li key={`${a.kind}-${"notionId" in a ? a.notionId : ""}`}>
                  <CardShell
                    tone={SHELL_TONE_FOR_GLOW[tone]}
                    className="h-full transition-transform duration-200 hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                  >
                    <Link
                      href={target.href}
                      className={cn(
                        "group flex h-full items-center gap-3 p-4 transition-colors hover:border-foreground/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                        INNER,
                      )}
                    >
                      <GlowTile tone={tone} size={40}>
                        <Glyph weight="fill" />
                      </GlowTile>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">
                          {t(`actions.${a.kind}`)}
                          {a.notionName ? ` · ${a.notionName}` : ""}
                        </span>
                        <span className="block text-sm text-muted-foreground">
                          {a.reason}
                        </span>
                      </span>
                      <ArrowRight
                        aria-hidden
                        className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-foreground motion-reduce:transition-none"
                      />
                    </Link>
                  </CardShell>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
