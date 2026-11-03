import { Info } from "@phosphor-icons/react/ssr";
import { Alert, AlertDescription } from "@wema/ui/components/ui/alert";
import { Button } from "@wema/ui/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@wema/ui/components/ui/table";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "../../../components/page-header";
import { MasteryChart } from "../../../components/school/mastery-chart";
import { getSchool } from "../../../components/school/school-context";
import { Stat } from "../../../components/school/stat";
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

  return (
    <div className="space-y-6">
      <PageHeader
        title={school.name}
        description={t("subtitle")}
        actions={
          can("classes.manage") ? (
            <Button asChild>
              <Link href={`/ecole/${orgId}/classes`}>{t("manageClasses")}</Link>
            </Button>
          ) : undefined
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t("classes")} value={classes.length} />
        <Stat label={t("learners")} value={learners} />
        <Stat
          label={t("active")}
          value={active}
          hint={
            learners > 0
              ? t("activeShare", {
                  value: Math.round((active / learners) * 100),
                })
              : undefined
          }
        />
        <Stat
          label={t("mastered")}
          value={average === null ? "–" : `${average} %`}
          hint={t("masteredHint")}
        />
      </div>

      {alerts.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-display text-xl font-bold">{t("alerts")}</h2>
          {alerts.map((a) => (
            <Alert key={`${a.id}:${a.text}`}>
              <Info aria-hidden />
              <AlertDescription>{a.text}</AlertDescription>
            </Alert>
          ))}
        </section>
      )}

      {classes.length === 0 ? (
        <p className="rounded-lg border bg-card p-6 text-muted-foreground">
          {t("noClasses")}
        </p>
      ) : (
        <>
          <section className="space-y-3 rounded-xl border bg-card p-5">
            <h2 className="font-display text-xl font-bold">
              {t("chartTitle")}
            </h2>
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
          <section className="space-y-3">
            <h2 className="font-display text-xl font-bold">{t("classList")}</h2>
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("className")}</TableHead>
                    <TableHead className="text-right">
                      {t("learners")}
                    </TableHead>
                    <TableHead className="text-right">{t("active")}</TableHead>
                    <TableHead className="text-right">
                      {t("mastered")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classes.map((k) => (
                    <TableRow key={k.classId}>
                      <TableCell className="font-medium">
                        {can("classes.manage") ? (
                          <Link
                            href={`/ecole/${orgId}/classes/${k.classId}`}
                            className="underline-offset-4 hover:underline"
                          >
                            {k.name}
                          </Link>
                        ) : (
                          k.name
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {k.learners}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {k.activeThisWeek}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {percent(k.masteredShare) === null
                          ? "–"
                          : `${percent(k.masteredShare)} %`}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
