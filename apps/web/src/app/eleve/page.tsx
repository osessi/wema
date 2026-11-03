import { ArrowRight, ChatCircleText } from "@phosphor-icons/react/ssr";
import { Button } from "@wema/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@wema/ui/components/ui/card";
import { Progress } from "@wema/ui/components/ui/progress";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { actionTarget } from "../../components/learner/actions";
import { NudgeReadButton } from "../../components/learner/nudge-read-button";
import { PageHeader } from "../../components/page-header";
import { load, serverApi } from "../../lib/api-server";

export default async function Page() {
  const t = await getTranslations("learner");
  const format = await getFormatter();
  const api = await serverApi();
  const [{ actions }, { nudges }, { assignments }, { classes }] =
    await Promise.all([
      load(api.learner.next.$get()),
      load(api.learner.nudges.$get()),
      load(api.learner.assignments.$get()),
      load(api.learner.path.$get()),
    ]);

  const [first, ...others] = actions;
  const firstTarget = first ? actionTarget(first) : null;
  const upcoming = assignments
    .filter((a) => a.status === "todo" || a.status === "late")
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
    .slice(0, 4);
  const unread = nudges.filter((n) => n.status === "ready");
  const notions = classes.flatMap((k) => k.notions);
  const count = (s: string) => notions.filter((n) => n.status === s).length;
  const mastered = count("mastered");

  return (
    <>
      <PageHeader title={t("home.title")} description={t("home.description")} />

      <Card className="border-brand bg-brand-soft">
        <CardHeader>
          <CardDescription className="font-medium text-foreground">
            {t("home.nextStep")}
          </CardDescription>
          <CardTitle className="font-display text-2xl">
            {first
              ? `${t(`actions.${first.kind}`)}${first.notionName ? ` · ${first.notionName}` : ""}`
              : t("home.nextEmpty")}
          </CardTitle>
          {first && <p className="text-muted-foreground">{first.reason}</p>}
        </CardHeader>
        {first && firstTarget && (
          <CardContent>
            <Button asChild size="lg">
              <Link href={firstTarget.href}>
                {t(`actions.go.${firstTarget.label}`)}
                <ArrowRight />
              </Link>
            </Button>
          </CardContent>
        )}
      </Card>

      {unread.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold">{t("home.nudges")}</h2>
          {unread.map((n) => (
            <Card key={n.id}>
              <CardContent className="flex items-start gap-3">
                <ChatCircleText className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                <p className="flex-1">{n.content}</p>
                <NudgeReadButton id={n.id} />
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-xl">
              {t("home.upcoming")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcoming.length === 0 ? (
              <p className="text-muted-foreground">{t("home.noUpcoming")}</p>
            ) : (
              <ul className="divide-y">
                {upcoming.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-3 py-2"
                  >
                    <div>
                      <p className="font-medium">{a.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {t("common.dueOn", {
                          date: format.dateTime(new Date(a.dueAt), {
                            dateStyle: "long",
                          }),
                        })}
                        {a.status === "late" &&
                          ` · ${t("assignmentStatus.late")}`}
                      </p>
                    </div>
                    {a.variantId && (
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/eleve/exercices/${a.variantId}`}>
                          {t("assignments.open")}
                        </Link>
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <Button asChild variant="link" className="px-0">
              <Link href="/eleve/devoirs">{t("home.allAssignments")}</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-xl">
              {t("home.progress")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {notions.length === 0 ? (
              <p className="text-muted-foreground">{t("progress.empty")}</p>
            ) : (
              <>
                <Progress
                  value={(mastered / notions.length) * 100}
                  aria-label={t("home.progress")}
                />
                <p className="text-sm text-muted-foreground">
                  {t("home.progressSummary", {
                    mastered,
                    inProgress: count("in_progress"),
                    needsWork: count("needs_work"),
                    total: notions.length,
                  })}
                </p>
              </>
            )}
            <Button asChild variant="link" className="px-0">
              <Link href="/eleve/progression">{t("home.seeProgress")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {others.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold">
            {t("home.otherActions")}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {others.map((a) => {
              const target = actionTarget(a);
              return (
                <li key={`${a.kind}-${"notionId" in a ? a.notionId : ""}`}>
                  <Link
                    href={target.href}
                    className="flex h-full items-center justify-between gap-3 rounded-xl border bg-card p-4 hover:bg-muted"
                  >
                    <span>
                      <span className="block font-medium">
                        {t(`actions.${a.kind}`)}
                        {a.notionName ? ` · ${a.notionName}` : ""}
                      </span>
                      <span className="block text-sm text-muted-foreground">
                        {a.reason}
                      </span>
                    </span>
                    <ArrowRight className="shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
