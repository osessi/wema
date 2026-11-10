import { CaretLeft, CaretRight } from "@phosphor-icons/react/ssr";
import { ILLUSTRATION_FOR } from "@wema/ui/components/illustrations/usages";
import { Button } from "@wema/ui/components/ui/button";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { PageHeader } from "../../../components/page-header";
import {
  BankBoard,
  type BankNotion,
} from "../../../components/teacher/bank-board";
import {
  isWeek,
  mondayOf,
  notionIndex,
  organizationExercises,
  pickOrganization,
  shiftWeek,
  teacherOrganizations,
} from "../../../components/teacher/data";
import { OrgSwitcher } from "../../../components/teacher/org-switcher";
import { load, serverApi } from "../../../lib/api-server";
import { getSpaces } from "../../../lib/spaces";

export default async function BankPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; week?: string }>;
}) {
  const query = await searchParams;
  const t = await getTranslations("teacher.bank");
  const format = await getFormatter();
  const org = await pickOrganization(query.org);
  if (!org)
    return (
      <>
        <PageHeader title={t("title")} />
        <EmptyState
          illustration={ILLUSTRATION_FOR.emptyExercises}
          title={t("title")}
          titleAs="h2"
          description={t("noOrganization")}
        />
      </>
    );
  const current = mondayOf(new Date());
  const week = isWeek(query.week) ? query.week : current;
  const api = await serverApi();
  const [{ entries }, exercises, index, orgs, { mine }] = await Promise.all([
    load(
      api.admin.organizations[":id"].bank.$get({
        param: { id: org.id },
        query: { week },
      }),
    ),
    organizationExercises(org.id),
    notionIndex(),
    teacherOrganizations(),
    getSpaces(),
  ]);
  const notions: Record<string, BankNotion> = {};
  for (const id of new Set([
    ...entries.map((e) => e.notionId),
    ...exercises.map((x) => x.notionId),
  ])) {
    const n = index.get(id);
    if (n)
      notions[id] = {
        name: n.name,
        context: `${n.countryName} · ${n.programLabel}`,
        icon: n.subjectIcon,
      };
  }
  const href = (w: string) => `/prof/banque?org=${org.id}&week=${w}`;
  const label = format.dateTime(new Date(`${week}T12:00:00Z`), {
    dateStyle: "long",
  });

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description", { week: label, org: org.name })}
        actions={
          <nav aria-label={t("weekNav")} className="flex items-center gap-1">
            <Button asChild variant="ghost" size="icon">
              <Link href={href(shiftWeek(week, -1))} aria-label={t("previous")}>
                <CaretLeft />
              </Link>
            </Button>
            <Button
              asChild
              variant={week === current ? "secondary" : "ghost"}
              size="sm"
            >
              <Link href={href(current)}>{t("thisWeek")}</Link>
            </Button>
            <Button asChild variant="ghost" size="icon">
              <Link href={href(shiftWeek(week, 1))} aria-label={t("next")}>
                <CaretRight />
              </Link>
            </Button>
          </nav>
        }
      />
      <OrgSwitcher
        orgs={orgs}
        current={org.id}
        href={(id) => `/prof/banque?org=${id}&week=${week}`}
      />
      <BankBoard
        key={`${org.id}-${week}`}
        orgId={org.id}
        week={week}
        entries={entries}
        exercises={exercises}
        notions={notions}
        classes={mine.teaching
          .filter((k) => k.organizationId === org.id)
          .map((k) => ({ id: k.id, name: k.name }))}
      />
    </>
  );
}
