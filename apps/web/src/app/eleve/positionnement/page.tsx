import { ArrowRight, Path } from "@phosphor-icons/react/ssr";
import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import { SubjectIcon } from "@wema/ui/components/wema/subject-icon";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { PageHeader } from "../../../components/page-header";
import { load, serverApi } from "../../../lib/api-server";

const STATE_BADGE = {
  not_started: "brand",
  in_progress: "info",
  done: "success",
} as const;

/** Test de niveau : une entrée par matière suivie, avant le parcours. */
export default async function Page() {
  const t = await getTranslations("learner.placement");
  const format = await getFormatter();
  const api = await serverApi();
  const { subjects } = await load(api.learner.placement.$get());

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <PageHeader title={t("title")} description={t("introText")} />
      {subjects.length === 0 ? (
        <EmptyState
          icon={<Path weight="fill" />}
          tone="amber"
          title={t("noSubject")}
          titleAs="h2"
          description={t("noSubjectHint")}
        />
      ) : (
        <section aria-labelledby="placement-subjects" className="space-y-3">
          <h2
            id="placement-subjects"
            className="font-mono text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase"
          >
            {t("subjects")}
          </h2>
          <ul className="space-y-3">
            {subjects.map((s) => {
              const href = `/eleve/positionnement/${s.subjectId}`;
              return (
                <li
                  key={s.subjectId}
                  className="flex flex-col gap-4 rounded-card border bg-card p-4 shadow-xs sm:flex-row sm:items-center"
                >
                  <SubjectIcon icon={s.subjectIcon} size={44} />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{s.programName}</p>
                      <Badge variant={STATE_BADGE[s.state]}>
                        {t(`state.${s.state}`)}
                      </Badge>
                    </div>
                    {s.completedAt && (
                      <p className="text-sm text-muted-foreground">
                        {t("doneOn", {
                          date: format.dateTime(new Date(s.completedAt), {
                            dateStyle: "long",
                          }),
                        })}
                      </p>
                    )}
                    {!s.hasQuestions && s.state === "not_started" && (
                      <p className="text-sm text-muted-foreground">
                        {t("noQuestions")}
                      </p>
                    )}
                  </div>
                  {s.state === "done" ? (
                    <Button
                      asChild
                      variant="outline"
                      className="w-full sm:w-auto"
                    >
                      <Link href={href}>
                        {t("seeResult")}
                        <ArrowRight aria-hidden />
                      </Link>
                    </Button>
                  ) : (
                    s.hasQuestions && (
                      <Button
                        asChild
                        variant="brand"
                        className="w-full sm:w-auto"
                      >
                        <Link href={href}>
                          {s.state === "in_progress" ? t("resume") : t("start")}
                          <ArrowRight aria-hidden />
                        </Link>
                      </Button>
                    )
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
