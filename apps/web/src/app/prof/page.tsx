import {
  ArrowRight,
  Books,
  CalendarCheck,
  GraduationCap,
  Sparkle,
  Student,
  WarningCircle,
} from "@phosphor-icons/react/ssr";
import { GlowTile, TsfFrame } from "@wema/ui/brand";
import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import { ProgressRing } from "@wema/ui/components/wema/progress-ring";
import { StatTile } from "@wema/ui/components/wema/stat-tile";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "../../components/page-header";
import {
  mondayOf,
  notionIndex,
  organizationExercises,
  teacherOrganizations,
} from "../../components/teacher/data";
import {
  InitialsAvatar,
  MonoLabel,
  SectionHeading,
} from "../../components/teacher/section";
import { load, serverApi } from "../../lib/api-server";
import { getSpaces } from "../../lib/spaces";

export default async function TeacherHome() {
  const t = await getTranslations("teacher.home");
  const { mine } = await getSpaces();
  const api = await serverApi();
  const now = Date.now();

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
      return {
        ...k,
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
          objective: byId.get(e.intentId)?.objective ?? "",
        })),
      };
    }),
  );

  const totalLearners = classes.reduce((s, k) => s + k.learners, 0);
  const totalOpen = classes.reduce((s, k) => s + k.open, 0);
  const totalBlocked = classes.reduce((s, k) => s + k.blocked.length, 0);
  const totalToSort = banks.reduce((s, b) => s + b.toSort.length, 0);

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />

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
            icon={<GraduationCap weight="fill" />}
            tone="sky"
            title={t("classesTitle")}
            description={t("noClasses")}
          />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {classes.map((k) => (
              <li
                key={k.id}
                className="flex h-full flex-col gap-4 rounded-card border bg-card p-5 shadow-xs"
              >
                <div className="flex items-center gap-3">
                  <GlowTile tone="sky" size={40}>
                    <GraduationCap weight="fill" />
                  </GlowTile>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-base font-semibold tracking-tight">
                      <Link
                        href={`/prof/classes/${k.id}`}
                        className="rounded-chip outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {k.name}
                      </Link>
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {t("learners", { count: k.learners })}
                    </p>
                  </div>
                  <ProgressRing
                    value={k.mastered}
                    max={k.cells}
                    size={52}
                    thickness={5}
                    tone="mint"
                    label={t("masteryLabel", { name: k.name })}
                  />
                </div>

                <dl className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-muted/60 px-3 py-2">
                    <dt className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                      {t("statOpen")}
                    </dt>
                    <dd className="text-xl font-light tabular-nums">
                      {k.open}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-muted/60 px-3 py-2">
                    <dt className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                      {t("statBlocked")}
                    </dt>
                    <dd
                      className={
                        k.blocked.length > 0
                          ? "text-xl font-light text-danger-text tabular-nums"
                          : "text-xl font-light tabular-nums"
                      }
                    >
                      {k.blocked.length}
                    </dd>
                  </div>
                </dl>

                <div className="flex-1 space-y-2">
                  {k.blocked.length > 0 ? (
                    <MonoLabel>{t("needHelp")}</MonoLabel>
                  ) : null}
                  {k.blocked.length === 0 ? (
                    <Badge variant="success">{t("noneBlocked")}</Badge>
                  ) : (
                    <ul className="flex flex-wrap gap-1.5">
                      {k.blocked.slice(0, 5).map((l) => (
                        <li key={l.userId}>
                          <Link
                            href={`/prof/eleves/${k.organizationId}/${l.userId}`}
                            className="inline-flex items-center gap-1.5 rounded-full bg-danger-soft py-0.5 pr-2.5 pl-0.5 text-xs font-medium text-danger-text outline-none hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <InitialsAvatar
                              name={l.displayName}
                              className="size-5 bg-card text-[9px]"
                            />
                            {l.displayName}
                          </Link>
                        </li>
                      ))}
                      {k.blocked.length > 5 ? (
                        <li>
                          <Badge variant="neutral">
                            {t("moreBlocked", { count: k.blocked.length - 5 })}
                          </Badge>
                        </li>
                      ) : null}
                    </ul>
                  )}
                </div>

                <div className="flex justify-end">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/prof/classes/${k.id}`}>
                      {t("openClass")}
                      <ArrowRight />
                    </Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
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
            icon={<Books weight="fill" />}
            tone="yellow"
            title={t("bankTitle")}
            description={t("noBank")}
          />
        ) : (
          banks.map((b) => (
            <TsfFrame key={b.org.id} innerClassName="p-5 sm:p-6">
              <div className="flex flex-col gap-5">
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
                  <ul className="divide-y overflow-hidden rounded-lg border bg-card">
                    {b.preview.map((p) => (
                      <li
                        key={p.id}
                        className="flex flex-col gap-1.5 px-4 py-3 text-sm sm:flex-row sm:items-center sm:gap-3"
                      >
                        <Badge variant="info" className="shrink-0">
                          {p.notion}
                        </Badge>
                        <span className="min-w-0 text-muted-foreground sm:truncate">
                          {p.objective}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState
                    variant="inline"
                    icon={<Sparkle weight="fill" />}
                    tone="yellow"
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
              </div>
            </TsfFrame>
          ))
        )}
      </section>
    </>
  );
}
