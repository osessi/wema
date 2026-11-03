import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@wema/ui/components/ui/breadcrumb";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@wema/ui/components/ui/card";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "../../../../components/page-header";
import {
  mondayOf,
  notionIndex,
  organizationExercises,
  pickOrganization,
} from "../../../../components/teacher/data";
import {
  ArchiveButton,
  PreviewDialog,
  ProposeButton,
  ValidateButton,
} from "../../../../components/teacher/exercise-actions";
import { ExerciseForm } from "../../../../components/teacher/exercise-form";
import { ExerciseStatusBadge } from "../../../../components/teacher/status";

export default async function ExercisePage({
  params,
  searchParams,
}: {
  params: Promise<{ exerciseId: string }>;
  searchParams: Promise<{ org?: string }>;
}) {
  const [{ exerciseId }, { org: requested }] = await Promise.all([
    params,
    searchParams,
  ]);
  const t = await getTranslations("teacher.form");
  const org = await pickOrganization(requested);
  if (!org) notFound();
  const exercise = (await organizationExercises(org.id)).find(
    (x) => x.id === exerciseId,
  );
  if (!exercise) notFound();
  const notions = await notionIndex();
  const own = exercise.organizationId === org.id;

  return (
    <>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={`/prof/exercices?org=${org.id}`}>
                {t("breadcrumb")}
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{exercise.objective}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <PageHeader
        title={exercise.objective}
        description={notions.get(exercise.notionId)?.name}
        actions={<ExerciseStatusBadge status={exercise.status} />}
      />
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>{t("checkTitle")}</CardTitle>
          <CardDescription>{t("checkHint")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-start gap-2">
          <PreviewDialog
            orgId={org.id}
            exerciseId={exercise.id}
            objective={exercise.objective}
          />
          {own && exercise.status === "draft" && (
            <ValidateButton exerciseId={exercise.id} />
          )}
          {exercise.status === "validated" && (
            <ProposeButton
              orgId={org.id}
              exerciseId={exercise.id}
              week={mondayOf(new Date())}
            />
          )}
          {own && exercise.status !== "archived" && (
            <ArchiveButton exerciseId={exercise.id} />
          )}
        </CardContent>
      </Card>
      {own ? (
        <ExerciseForm
          key={`${exercise.id}-${exercise.version}`}
          orgId={org.id}
          notions={[...notions.values()]}
          exercise={exercise}
        />
      ) : (
        <p className="text-sm text-muted-foreground">{t("readOnly")}</p>
      )}
    </>
  );
}
