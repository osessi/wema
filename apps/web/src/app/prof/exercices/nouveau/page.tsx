import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@wema/ui/components/ui/breadcrumb";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "../../../../components/page-header";
import {
  notionIndex,
  pickOrganization,
} from "../../../../components/teacher/data";
import { ExerciseForm } from "../../../../components/teacher/exercise-form";

export default async function NewExercisePage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; notion?: string }>;
}) {
  const { org: requested } = await searchParams;
  const t = await getTranslations("teacher.form");
  const org = await pickOrganization(requested);
  if (!org) notFound();
  const notions = [...(await notionIndex()).values()];
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
            <BreadcrumbPage>{t("newTitle")}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <PageHeader title={t("newTitle")} description={t("newDescription")} />
      <ExerciseForm orgId={org.id} notions={notions} />
    </>
  );
}
