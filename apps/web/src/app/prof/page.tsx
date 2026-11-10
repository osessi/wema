import {
  ArrowRight,
  Books,
  CalendarCheck,
  Sparkle,
  Student,
  WarningCircle,
} from "@phosphor-icons/react/ssr";
import { GlowTile } from "@wema/ui/brand";
import { DonutChart } from "@wema/ui/components/charts/index";
import { ILLUSTRATION_FOR } from "@wema/ui/components/illustrations/usages";
import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import { Card } from "@wema/ui/components/ui/card";
import { ClassCard } from "@wema/ui/components/wema/class-card";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import { StatTile } from "@wema/ui/components/wema/stat-tile";
import { SubjectIcon } from "@wema/ui/components/wema/subject-icon";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "../../components/page-header";
import {
  mondayOf,
  notionIndex,
  organizationExercises,
  programInfo,
  teacherOrganizations,
} from "../../components/teacher/data";
import { MonoLabel, SectionHeading } from "../../components/teacher/section";
import { StartChecklist } from "../../components/tutoring/start-checklist";
import { load, serverApi } from "../../lib/api-server";
import { getSpaces } from "../../lib/spaces";

const STATUSES = ["mastered", "in_progress", "needs_work", "not_seen"] as const;
const STATUS_TONE = {
  mastered: "mint",
  in_progress: "yellow",
  needs_work: "rose",
  not_seen: "slate",
} as const;

export default async function TeacherHome() {
  const t = await getTranslations("teacher.home");
  const ts = await getTranslations("teacher.status");
  const { mine } = await getSpaces();
  const api = await serverApi();
  const now = Date.now();
  const programs = await programInfo();

  const classes = await Promise.all(
    mine.teaching.map(async (k) => {
      const [map, { assignments }] = await Promise.all([
        load(api.admin.classes[":id"].map.$get({ param: { id: k.id } })),
        load(
          api.admin.classes[":id"].assignments.$get({ param: { id: k.id } }),
        ),
      ]);
      // Un élève « bloque » s'il a une idée fausse active ou une notion à travailler.
      const blocked = map.learners.filter(
        (l) =>
          l.activeMisconceptions > 0 ||
          Object.values(l.statuses).includes("needs_work"),
      );
      const cells = map.learners.length * map.notions.length;
      const mastered = map.learners.reduce(
        (sum, l) =>
          sum +
          Object.values(l.statuses).filter((s) => s === "mastered").length,
        0,
      );
      const counts = {
        not_seen: 0,
        needs_work: 0,
        in_progress: 0,
        mastered: 0,
      };
      for (const n of map.notions)
        for (const s of STATUSES) counts[s] += n.counts[s];
      return {
        ...k,
        icon: map.class.programId
          ? (programs.get(map.class.programId)?.icon ?? null)
          : null,
        program: map.class.programId
          ? (programs.get(map.class.programId)?.label ?? null)
          : null,
        counts,
        students: map.learners.map((l) => ({
          id: l.userId,
          name: l.displayName,
        })),
        learners: map.learners.length,
        blocked,
        mastered,
        cells,
        open: assignments.filter((a) => new Date(a.dueAt).getTime() >= now)
          .length,
      };
    }),
  );

  const week = mondayOf(new Date());
  const orgs = await teacherOrganizations();
  const notions = await notionIndex();
  const banks = await Promise.all(
    orgs.map(async (o) => {
      const [{ entries }, exercises] = await Promise.all([
        load(
          api.admin.organizations[":id"].bank.$get({
            param: { id: o.id },
            query: { week },
          }),
        ),
        organizationExercises(o.id),
      ]);
      const toSort = entries.filter((e) => e.status === "proposed");
      const byId = new Map(exercises.map((x) => [x.id, x]));
      return {
        org: o,
        toSort,
        selected: entries.filter((e) => e.status === "selected").length,
        preview: toSort.slice(0, 4).map((e) => ({
          id: e.id,
          notion: notions.get(e.notionId)?.name ?? t("unknownNotion"),
          icon: notions.get(e.notionId)?.subjectIcon ?? null,
          objective: byId.get(e.intentId)?.objective ?? "",
        })),
      };
    }),
  );

  const totalLearners = classes.reduce((s, k) => s + k.learners, 0);
  const totalOpen = classes.reduce((s, k) => s + k.open, 0);
  const totalBlocked = classes.reduce((s, k) => s + k.blocked.length, 0);
  const totalToSort = banks.reduce((s, b) => s + b.toSort.length, 0);
  const statusTotals = {
    not_seen: 0,
    needs_work: 0,
    in_progress: 0,
    mastered: 0,
  };
  for (const k of classes)
    for (const s of STATUSES) statusTotals[s] += k.counts[s];
  const totalCells = STATUSES.reduce((sum, s) => sum + statusTotals[s], 0);

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <StartChecklist />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label={t("statLearners")}
          value={totalLearners}
          icon={<Student weight="fill" />}
          tone="sky"
          hint={t("statLearnersHint", { count: classes.length })}
        />
        <StatTile
          label={t("statOpen")}
          value={totalOpen}
          icon={<CalendarCheck weight="fill" />}
          tone="mint"
          hint={t("statOpenHint")}
        />
        <StatTile
          label={t("statBlocked")}
          value={totalBlocked}
          icon={<WarningCircle weight="fill" />}
          tone={totalBlocked > 0 ? "rose" : "slate"}
          hint={t("statBlockedHint")}
        />
        <StatTile
          label={t("statToSort")}
          value={totalToSort}
          icon={<Sparkle weight="fill" />}
          tone="yellow"
          hint={t("statToSortHint")}
        />
      </div>

      <section className="space-y-4" aria-labelledby="classes-title">
        <SectionHeading
          id="classes-title"
          eyebrow={t("classesEyebrow")}
          title={t("classesTitle")}
        />
        {classes.length === 0 ? (
          <EmptyState
            illustration={ILLUSTRATION_FOR.emptyClasses}
            title={t("classesTitle")}
            description={t("noClasses")}
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <ul className="grid content-start gap-4 md:grid-cols-2">
              {classes.map((k) => (
                <li key={k.id} className="min-w-0">
                  <ClassCard
                    tone={k.blocked.length > 0 ? "rose" : "sky"}
                    title={
                      <Link
                        href={`/prof/classes/${k.id}`}
                        className="rounded-chip outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {k.name}
                      </Link>
                    }
                    subtitle={k.program ?? t("learners", { count: k.learners })}
                    media={<SubjectIcon icon={k.icon} size={44} />}
                    progress={
                      k.cells > 0 ? Math.round((k.mastered / k.cells) * 100) : 0
                    }
                    progressLabel={t("masteryLabel", { name: k.name })}
                    stats={[
                      { label: t("statOpen"), value: k.open },
                      {
                        label: t("statBlocked"),
                        value: k.blocked.length,
                        tone: k.blocked.length > 0 ? "alert" : "default",
                      },
                    ]}
                    students={k.students}
                    studentsLabel={t("learners", { count: k.learners })}
                    flagged={k.blocked.slice(0, 5).map((l) => ({
                      id: l.userId,
                      name: l.displayName,
                    }))}
                    flaggedLabel={t("needHelp")}
                    action={
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/prof/classes/${k.id}`}>
                          {t("openClass")}
                          <ArrowRight />
                        </Link>
                      </Button>
                    }
                  />
                </li>
              ))}
            </ul>
            <Card tone="mint" className="h-full gap-4 px-5 py-5">
              <div className="space-y-1">
                <MonoLabel>{t("mastery")}</MonoLabel>
                <h3 className="font-semibold tracking-tight">
                  {t("statusTitle")}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t("statusHint")}
                </p>
              </div>
              <DonutChart
                label={t("statusTitle")}
                data={STATUSES.map((s) => ({
                  name: ts(s),
                  value: statusTotals[s],
                  tone: STATUS_TONE[s],
                }))}
                centerValue={`${totalCells > 0 ? Math.round((statusTotals.mastered / totalCells) * 100) : 0} %`}
                centerLabel={t("centerLabel")}
              />
            </Card>
          </div>
        )}
      </section>

      <section className="space-y-4" aria-labelledby="bank-title">
        <SectionHeading
          id="bank-title"
          eyebrow={t("bankEyebrow")}
          title={t("bankTitle")}
        />
        {banks.length === 0 ? (
          <EmptyState
            illustration={ILLUSTRATION_FOR.emptyExercises}
            title={t("bankTitle")}
            description={t("noBank")}
          />
        ) : (
          banks.map((b) => (
            <Card
              key={b.org.id}
              tone="brand"
              className="gap-5 px-5 py-5 sm:px-6"
            >
              <div className="flex flex-wrap items-center gap-3">
                <GlowTile tone="yellow" size={44}>
                  <Books weight="fill" />
                </GlowTile>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold tracking-tight">
                    {b.org.name}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t("bankSummary", {
                      toSort: b.toSort.length,
                      selected: b.selected,
                    })}
                  </p>
                </div>
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                  <Badge
                    variant={b.toSort.length > 0 ? "brand" : "neutral"}
                    className="font-mono tracking-wider uppercase"
                  >
                    {t("toSortCount", { count: b.toSort.length })}
                  </Badge>
                  <Badge variant={b.selected > 0 ? "success" : "neutral"}>
                    {t("selectedCount", { count: b.selected })}
                  </Badge>
                </div>
              </div>
              {b.preview.length > 0 ? (
                <ul className="grid gap-2.5 sm:grid-cols-2">
                  {b.preview.map((p) => (
                    <li
                      key={p.id}
                      className="flex min-w-0 items-start gap-3 rounded-control border bg-muted/40 p-3 text-sm"
                    >
                      <SubjectIcon icon={p.icon} size={28} />
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="font-medium">{p.notion}</span>
                        <span className="line-clamp-2 text-muted-foreground">
                          {p.objective}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  variant="inline"
                  illustration={ILLUSTRATION_FOR.emptyExercises}
                  title={t("bankEmpty")}
                  titleAs="p"
                />
              )}
              <div className="flex justify-end">
                <Button asChild variant="brand">
                  <Link href={`/prof/banque?org=${b.org.id}`}>
                    {t("sortBank")}
                    <ArrowRight />
                  </Link>
                </Button>
              </div>
            </Card>
          ))
        )}
      </section>
    </>
  );
}
