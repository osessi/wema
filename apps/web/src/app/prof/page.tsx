import {
  ArrowRight,
  Books,
  CalendarCheck,
  Student,
  WarningCircle,
} from "@phosphor-icons/react/ssr";
import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@wema/ui/components/ui/card";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "../../components/page-header";
import {
  mondayOf,
  notionIndex,
  organizationExercises,
  teacherOrganizations,
} from "../../components/teacher/data";
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
      return {
        ...k,
        learners: map.learners.length,
        blocked,
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

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />

      <section className="space-y-3" aria-labelledby="classes-title">
        <h2 id="classes-title" className="font-display text-xl font-bold">
          {t("classesTitle")}
        </h2>
        {classes.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground">
              {t("noClasses")}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {classes.map((k) => (
              <Card key={k.id} className="shadow-none">
                <CardHeader>
                  <CardTitle className="font-display text-lg">
                    <Link
                      href={`/prof/classes/${k.id}`}
                      className="hover:underline"
                    >
                      {k.name}
                    </Link>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <Student className="size-4 text-muted-foreground" />
                      {t("learners", { count: k.learners })}
                    </li>
                    <li className="flex items-center gap-2">
                      <CalendarCheck className="size-4 text-muted-foreground" />
                      {t("openAssignments", { count: k.open })}
                    </li>
                    <li className="flex items-center gap-2">
                      <WarningCircle className="size-4 text-muted-foreground" />
                      {k.blocked.length === 0 ? (
                        <span className="text-muted-foreground">
                          {t("noneBlocked")}
                        </span>
                      ) : (
                        <span>{t("blocked", { count: k.blocked.length })}</span>
                      )}
                    </li>
                  </ul>
                  {k.blocked.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {k.blocked.slice(0, 5).map((l) => (
                        <Badge
                          key={l.userId}
                          asChild
                          className="bg-peach text-peach-ink"
                        >
                          <Link
                            href={`/prof/eleves/${k.organizationId}/${l.userId}`}
                          >
                            {l.displayName}
                          </Link>
                        </Badge>
                      ))}
                    </div>
                  )}
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/prof/classes/${k.id}`}>
                      {t("openClass")}
                      <ArrowRight />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="bank-title">
        <h2 id="bank-title" className="font-display text-xl font-bold">
          {t("bankTitle")}
        </h2>
        {banks.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground">
              {t("noBank")}
            </CardContent>
          </Card>
        ) : (
          banks.map((b) => (
            <Card key={b.org.id} className="shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Books className="size-5" />
                  {b.org.name}
                </CardTitle>
                <CardDescription>
                  {t("bankSummary", {
                    toSort: b.toSort.length,
                    selected: b.selected,
                  })}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {b.preview.length > 0 ? (
                  <ul className="divide-y rounded-lg border">
                    {b.preview.map((p) => (
                      <li key={p.id} className="px-3 py-2 text-sm">
                        <span className="font-medium">{p.notion}</span>
                        <span className="text-muted-foreground">
                          {" "}
                          · {p.objective}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t("bankEmpty")}
                  </p>
                )}
                <Button asChild>
                  <Link href={`/prof/banque?org=${b.org.id}`}>
                    {t("sortBank")}
                    <ArrowRight />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </section>
    </>
  );
}
