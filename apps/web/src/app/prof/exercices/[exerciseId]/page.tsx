import { Lock, SealCheck } from "@phosphor-icons/react/ssr";
import { GlowTile } from "@wema/ui/brand";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@wema/ui/components/ui/breadcrumb";
import { Card } from "@wema/ui/components/ui/card";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import { SubjectIcon } from "@wema/ui/components/wema/subject-icon";
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
import {
  ExerciseStatusBadge,
  KindBadge,
  SourceBadge,
} from "../../../../components/teacher/status";

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
  const tk = await getTranslations("teacher.form.kinds");
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
            <BreadcrumbPage className="block max-w-[14rem] truncate sm:max-w-md">
              {exercise.objective}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <PageHeader
        eyebrow={notions.get(exercise.notionId)?.name ?? t("eyebrow")}
        title={exercise.objective}
        description={
          <span className="flex flex-wrap items-center gap-1.5 pt-1">
            <ExerciseStatusBadge status={exercise.status} />
            <SourceBadge source={own ? exercise.source : "wema"} />
            <KindBadge label={tk(exercise.task.kind)} />
          </span>
        }
        actions={
          <SubjectIcon
            icon={notions.get(exercise.notionId)?.subjectIcon}
            size={44}
          />
        }
      />
      <Card
        tone="mint"
        className="gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex min-w-0 items-start gap-3">
          <GlowTile tone="mint" size={40}>
            <SealCheck weight="fill" />
          </GlowTile>
          <div className="min-w-0 space-y-1">
            <h2 className="font-semibold tracking-tight">{t("checkTitle")}</h2>
            <p className="text-sm text-muted-foreground">{t("checkHint")}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-start gap-2">
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
        </div>
      </Card>
      {own ? (
        <ExerciseForm
          key={`${exercise.id}-${exercise.version}`}
          orgId={org.id}
          notions={[...notions.values()]}
          exercise={exercise}
        />
      ) : (
        <EmptyState
          icon={<Lock weight="fill" />}
          tone="slate"
          title={t("readOnly")}
          titleAs="p"
        />
      )}
    </>
  );
}
