import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { SubjectIcon } from "@wema/ui/components/wema/subject-icon";
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

  const unitIds = new Set(units.map((u) => u.id));
  const active = curriculum.notions.filter(
    (n) => unitIds.has(n.unitId) && !n.archived,
  );
  const verified = active.filter((n) => n.verified).length;
  return (
    <>
      <Link
        href={`/admin/referentiel/${country.id}`}
        className="inline-flex w-fit items-center gap-1.5 rounded-md text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <ArrowLeft aria-hidden className="size-3.5" />
        {country.name}
      </Link>
      <div className="flex items-start gap-4">
        <SubjectIcon
          icon={subject?.icon}
          size={56}
          className="mt-1 hidden sm:inline-flex"
        />
        <div className="min-w-0 flex-1">
          <PageHeader
            title={`${subject?.name ?? ""} · ${grade?.name ?? ""}`}
            description={`${t("curriculum.program")} · ${country.name}`}
            eyebrow={`${t("curriculum.program")} · ${country.code}`}
          />
        </div>
      </div>
      <ProgramEditor
        programId={program.id}
        unitLabel={country.unitLabel}
        units={units}
        notions={curriculum.notions}
        canWrite={canWrite}
        stats={{ total: active.length, verified }}
      />
    </>
  );
}
