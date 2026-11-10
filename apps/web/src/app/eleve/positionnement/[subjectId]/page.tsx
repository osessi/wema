import { ArrowLeft } from "@phosphor-icons/react/ssr";
import { Button } from "@wema/ui/components/ui/button";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { PlacementResult } from "../../../../components/learner/placement-result";
import { PlacementRunner } from "../../../../components/learner/placement-runner";
import { PageHeader } from "../../../../components/page-header";
import { load, serverApi } from "../../../../lib/api-server";

/**
 * Test de niveau d'une matière : le test (introduction puis questions), ou
 * son bilan une fois terminé.
 */
export default async function Page({
  params,
}: {
  params: Promise<{ subjectId: string }>;
}) {
  const { subjectId } = await params;
  const t = await getTranslations("learner.placement");
  const format = await getFormatter();
  const api = await serverApi();
  const { subjects } = await load(api.learner.placement.$get());
  const subject = subjects.find((s) => s.subjectId === subjectId);
  if (!subject) notFound();

  const back = (
    <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
      <Link href="/eleve/positionnement">
        <ArrowLeft />
        {t("backToList")}
      </Link>
    </Button>
  );

  if (subject.state === "done") {
    const result = await load(
      api.learner.placement[":subjectId"].result.$get({
        param: { subjectId },
      }),
    );
    return (
      <div className="mx-auto w-full max-w-2xl space-y-6">
        {back}
        <PageHeader
          title={t("resultTitle", { subject: result.subjectName })}
          description={t("resultDescription")}
        />
        <p className="text-sm text-muted-foreground">
          {t("answered", { count: result.answered })}
          {result.availableAt &&
            ` · ${t("availableAt", {
              date: format.dateTime(new Date(result.availableAt), {
                dateStyle: "long",
              }),
            })}`}
        </p>
        <PlacementResult result={result} />
        {!result.availableAt && (
          <PlacementRunner
            subjectId={subjectId}
            subjectIcon={subject.subjectIcon}
            started={false}
          />
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      {back}
      <PageHeader title={t("title")} description={subject.programName} />
      <PlacementRunner
        subjectId={subjectId}
        subjectIcon={subject.subjectIcon}
        started={subject.state === "in_progress"}
      />
    </div>
  );
}
