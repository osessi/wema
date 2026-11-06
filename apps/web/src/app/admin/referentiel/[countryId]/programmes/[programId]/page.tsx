import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@wema/ui/components/ui/breadcrumb";
import { Card, CardContent } from "@wema/ui/components/ui/card";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "../../../../../../components/page-header";
import { load, serverApi } from "../../../../../../lib/api-server";
import { hasPermission } from "../../../../../../lib/session";
import { ProgramEditor } from "./program-editor";

export default async function ProgramPage({
  params,
}: {
  params: Promise<{ countryId: string; programId: string }>;
}) {
  const { countryId, programId } = await params;
  const t = await getTranslations();
  const api = await serverApi();
  const curriculum = await load(
    api.admin.curriculum.countries[":id"].curriculum.$get({
      param: { id: countryId },
    }),
  );
  const program = curriculum.programs.find((p) => p.id === programId);
  if (!program) notFound();
  const canWrite = await hasPermission("curriculum.write");
  const { country } = curriculum;
  const grade = curriculum.grades.find((g) => g.id === program.gradeId);
  const subject = curriculum.subjects.find((s) => s.id === program.subjectId);
  const units = curriculum.units.filter((u) => u.programId === program.id);

  return (
    <>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/admin/referentiel">{t("curriculum.title")}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={`/admin/referentiel/${country.id}`}>
                {country.name}
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>
              {grade?.name} · {subject?.name}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <PageHeader
        title={`${subject?.name ?? ""} · ${grade?.name ?? ""}`}
        description={`${t("curriculum.program")} · ${country.name}`}
      />
      <Card>
        <CardContent>
          <ProgramEditor
            programId={program.id}
            unitLabel={country.unitLabel}
            units={units}
            notions={curriculum.notions}
            canWrite={canWrite}
          />
        </CardContent>
      </Card>
    </>
  );
}
