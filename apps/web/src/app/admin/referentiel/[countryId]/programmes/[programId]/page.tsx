import { Card, PageHeader } from "@wema/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
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
      <PageHeader
        breadcrumb={
          <>
            <Link href="/admin/referentiel">{t("curriculum.title")}</Link> ›{" "}
            <Link href={`/admin/referentiel/${country.id}`}>
              {country.name}
            </Link>{" "}
            › {grade?.name} · {subject?.name}
          </>
        }
        title={`${subject?.name ?? ""} · ${grade?.name ?? ""}`}
        subtitle={`${t("curriculum.program")} · ${country.name}`}
      />
      <Card>
        <ProgramEditor
          programId={program.id}
          unitLabel={country.unitLabel}
          units={units}
          notions={curriculum.notions}
          canWrite={canWrite}
        />
      </Card>
    </>
  );
}
