import {
  CaretRight,
  ChalkboardTeacher,
  ChartLineUp,
  Lightning,
  Plus,
  Sparkle,
  Student,
  Warning,
} from "@phosphor-icons/react/ssr";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@wema/ui/components/ui/alert";
import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@wema/ui/components/ui/table";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import { StatTile } from "@wema/ui/components/wema/stat-tile";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "../../../components/page-header";
import { MasteryChart } from "../../../components/school/mastery-chart";
import { MiniBar } from "../../../components/school/mini-bar";
import { getSchool } from "../../../components/school/school-context";
import { SectionTitle } from "../../../components/school/section-title";
import { load, serverApi } from "../../../lib/api-server";

const percent = (share: number | null) =>
  share === null ? null : Math.round(share * 100);

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
  const manage = can("classes.manage");

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
          icon={<ChalkboardTeacher weight="fill" />}
          tone="sky"
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
          <section className="space-y-4 rounded-card border bg-card p-4 shadow-xs sm:p-6">
            <SectionTitle
              eyebrow={t("chartEyebrow")}
              title={t("chartTitle")}
              icon={<ChartLineUp weight="fill" />}
            />
            <MasteryChart
              data={classes.map((k) => ({
                name: k.name,
                mastered: percent(k.masteredShare) ?? 0,
                active:
                  k.learners > 0
                    ? Math.round((k.activeThisWeek / k.learners) * 100)
                    : 0,
              }))}
            />
          </section>
          <section className="space-y-4">
            <SectionTitle title={t("classList")} />
            <div className="overflow-hidden rounded-card border bg-card shadow-xs">
              <Table className="min-w-[560px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">{t("className")}</TableHead>
                    <TableHead className="text-right">
                      {t("learners")}
                    </TableHead>
                    <TableHead className="w-44">{t("active")}</TableHead>
                    <TableHead className="w-44 pr-4">{t("mastered")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classes.map((k) => {
                    const activeShare =
                      k.learners > 0
                        ? Math.round((k.activeThisWeek / k.learners) * 100)
                        : null;
                    const mastered = percent(k.masteredShare);
                    return (
                      <TableRow key={k.classId} className="h-14">
                        <TableCell className="pl-4 font-medium">
                          {manage ? (
                            <Link
                              href={`/ecole/${orgId}/classes/${k.classId}`}
                              className="inline-flex items-center gap-1.5 underline-offset-4 hover:underline"
                            >
                              {k.name}
                              <CaretRight
                                aria-hidden
                                className="size-3 text-muted-foreground"
                              />
                            </Link>
                          ) : (
                            k.name
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {k.learners}
                        </TableCell>
                        <TableCell>
                          <MiniBar
                            value={activeShare}
                            text={`${k.activeThisWeek}`}
                            tone="brand"
                          />
                        </TableCell>
                        <TableCell className="pr-4">
                          <MiniBar
                            value={mastered}
                            text={mastered === null ? "–" : `${mastered} %`}
                            tone="mint"
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
