import { ArrowLeft } from "@phosphor-icons/react/ssr";
import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { ExerciseFormats } from "../../../../components/formats/exercise-formats";
import { PhotoReview } from "../../../../components/learner/photo-review";
import { PageHeader } from "../../../../components/page-header";
import { load, serverApi } from "../../../../lib/api-server";

export default async function Page({
  params,
}: {
  params: Promise<{ variantId: string }>;
}) {
  const { variantId } = await params;
  const t = await getTranslations("learner");
  const format = await getFormatter();
  const api = await serverApi();
  const [{ variants }, { assignments }] = await Promise.all([
    load(api.learner.variants.$get()),
    load(api.learner.assignments.$get()),
  ]);
  const variant = variants.find((v) => v.id === variantId);
  const assignment = assignments.find((a) => a.variantId === variantId);

  const back = (
    <Button asChild variant="ghost" size="sm" className="w-fit">
      <Link href="/eleve/exercices">
        <ArrowLeft />
        {t("common.back")}
      </Link>
    </Button>
  );

  if (!variant)
    return (
      <>
        {back}
        <p className="text-muted-foreground">{t("exercises.notFound")}</p>
      </>
    );

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      {back}
      <PageHeader
        title={assignment?.title ?? t("exercises.statement")}
        description={
          assignment
            ? t("common.dueOn", {
                date: format.dateTime(new Date(assignment.dueAt), {
                  dateStyle: "long",
                }),
              })
            : undefined
        }
      />
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">
          {t("exercises.level", { level: variant.level })}
        </Badge>
        {variant.scaffolded && (
          <Badge variant="secondary">{t("exercises.guided")}</Badge>
        )}
      </div>
      <ExerciseFormats
        variant={variant}
        presentation={
          await load(
            api.learner.variants[":id"].presentation.$get({
              param: { id: variant.id },
            }),
          )
        }
        status={assignment?.status ?? null}
      />
      <PhotoReview variantId={variant.id} />
    </div>
  );
}
