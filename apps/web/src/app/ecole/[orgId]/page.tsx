import {
  CaretRight,
  ChalkboardTeacher,
  ChartBar,
  Lightning,
  Plus,
  Sparkle,
  Student,
  Warning,
} from "@phosphor-icons/react/ssr";
import { BarChart } from "@wema/ui/components/charts/index";
import { ILLUSTRATION_FOR } from "@wema/ui/components/illustrations/usages";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@wema/ui/components/ui/alert";
import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import { Card } from "@wema/ui/components/ui/card";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import { StatTile } from "@wema/ui/components/wema/stat-tile";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "../../../components/page-header";
import {
  ClassCardGrid,
  loadClassCards,
} from "../../../components/school/class-cards";
import { getSchool } from "../../../components/school/school-context";
import { SectionTitle } from "../../../components/school/section-title";
import { load, serverApi } from "../../../lib/api-server";

export default async function Page({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const { school, can } = await getSchool(orgId);
  const t = await getTranslations("school.overview");
  const api = await serverApi();
  const { classes } = await load(
    api.admin.organizations[":id"].overview.$get({ param: { id: orgId } }),
  );
  const manage = can("classes.manage");
  const cards = await loadClassCards(orgId, classes, manage);

  const learners = classes.reduce((s, k) => s + k.learners, 0);
  const active = classes.reduce((s, k) => s + k.activeThisWeek, 0);
  const shares = classes
    .map((k) => k.masteredShare)
    .filter((x): x is number => x !== null);
  const average =
    shares.length > 0
      ? Math.round((shares.reduce((a, b) => a + b, 0) / shares.length) * 100)
      : null;
  const alerts = [
    ...classes
      .filter((k) => k.learners === 0)
      .map((k) => ({ id: k.classId, text: t("alertEmpty", { name: k.name }) })),
    ...classes
      .filter((k) => k.learners > 0 && k.activeThisWeek === 0)
      .map((k) => ({
        id: k.classId,
        text: t("alertInactive", { name: k.name }),
      })),
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title={school.name}
        description={t("subtitle")}
        actions={
          manage ? (
            <Button asChild>
              <Link href={`/ecole/${orgId}/classes`}>
                <ChalkboardTeacher aria-hidden />
                {t("manageClasses")}
              </Link>
            </Button>
          ) : undefined
        }
      />
      <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-4">
        <StatTile
          className="h-full"
          label={t("classes")}
          value={classes.length}
          icon={<ChalkboardTeacher weight="fill" />}
          tone="sky"
        />
        <StatTile
          className="h-full"
          label={t("learners")}
          value={learners}
          icon={<Student weight="fill" />}
          tone="mint"
        />
        <StatTile
          className="h-full"
          label={t("active")}
          value={active}
          icon={<Lightning weight="fill" />}
          tone="yellow"
          hint={
            learners > 0
              ? t("activeShare", {
                  value: Math.round((active / learners) * 100),
                })
              : undefined
          }
        />
        <StatTile
          className="h-full"
          label={t("mastered")}
          value={average === null ? "–" : `${average} %`}
          icon={<Sparkle weight="fill" />}
          tone="amber"
          hint={t("masteredHint")}
        />
      </div>

      {alerts.length > 0 && (
        <section className="space-y-3">
          <SectionTitle
            title={t("alerts")}
            icon={<Warning weight="fill" />}
            tone="amber"
            aside={
              <Badge variant="warning" className="tabular-nums">
                {alerts.length}
              </Badge>
            }
          />
          <div className="grid gap-3 md:grid-cols-2">
            {alerts.map((a) => (
              <Alert key={`${a.id}:${a.text}`} variant="warning">
                <Warning aria-hidden weight="fill" />
                <AlertTitle className="sr-only">{t("alerts")}</AlertTitle>
                <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                  <span>{a.text}</span>
                  {manage && (
                    <Link
                      href={`/ecole/${orgId}/classes/${a.id}`}
                      className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-4 hover:underline"
                    >
                      {t("openClass")}
                      <CaretRight aria-hidden className="size-3" />
                    </Link>
                  )}
                </AlertDescription>
              </Alert>
            ))}
          </div>
        </section>
      )}

      {classes.length === 0 ? (
        <EmptyState
          illustration={ILLUSTRATION_FOR.emptyClasses}
          titleAs="h2"
          title={t("noClassesTitle")}
          description={t("noClasses")}
          action={
            manage ? (
              <Button asChild variant="brand">
                <Link href={`/ecole/${orgId}/classes`}>
                  <Plus aria-hidden />
                  {t("createClass")}
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <Card className="gap-5 px-4 py-4 sm:px-6 sm:py-6">
            <SectionTitle
              eyebrow={t("chartEyebrow")}
              title={t("chartTitle")}
              icon={<ChartBar weight="fill" />}
              tone="yellow"
            />
            <BarChart
              label={t("chartTitle")}
              summary={t("chartSummary", { learners, active })}
              data={classes.map((k) => ({
                name: k.name,
                learners: k.learners,
                active: k.activeThisWeek,
              }))}
              x="name"
              xLabel={t("className")}
              series={[
                { key: "learners", label: t("learners"), tone: "sky" },
                { key: "active", label: t("active"), tone: "yellow" },
              ]}
              layout={classes.length > 5 ? "horizontal" : "vertical"}
              integer
              className={classes.length > 5 ? "h-96" : "h-56 sm:h-64"}
            />
          </Card>
          <section className="space-y-4">
            <SectionTitle title={t("classList")} />
            <ClassCardGrid
              orgId={orgId}
              classes={cards}
              manage={manage}
              titleAs="h3"
            />
          </section>
        </>
      )}
    </div>
  );
}
