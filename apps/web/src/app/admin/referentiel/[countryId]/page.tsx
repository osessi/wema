import { Card, PageHeader } from "@wema/ui";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { load, serverApi } from "../../../../lib/api-server";
import { hasPermission } from "../../../../lib/session";
import { CountryForm } from "../country-form";
import { GradeList } from "./grade-list";
import { ProgramList } from "./program-list";

export default async function CountryPage({
  params,
}: {
  params: Promise<{ countryId: string }>;
}) {
  const { countryId } = await params;
  const t = await getTranslations();
  const api = await serverApi();
  const curriculum = await load(
    api.admin.curriculum.countries[":id"].curriculum.$get({
      param: { id: countryId },
    }),
  );
  const canWrite = await hasPermission("curriculum.write");
  const { country } = curriculum;

  const unitIdsByProgram = new Map<string, Set<string>>();
  for (const u of curriculum.units) {
    unitIdsByProgram.set(
      u.programId,
      (unitIdsByProgram.get(u.programId) ?? new Set()).add(u.id),
    );
  }
  const programs = curriculum.programs.map((p) => ({
    ...p,
    notionCount: curriculum.notions.filter(
      (n) => !n.archived && unitIdsByProgram.get(p.id)?.has(n.unitId),
    ).length,
  }));

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link href="/admin/referentiel">{t("curriculum.title")}</Link>
        }
        title={`${country.name} (${country.code})`}
        subtitle={country.unitLabel.plural}
      />
      <div className="w-stack" style={{ gap: 20 }}>
        <Card
          title={t("curriculum.programs")}
          subtitle={t("curriculum.programsHint")}
        >
          <ProgramList
            // Remonté quand les classes ou les matières changent : les choix repartent des listes à jour.
            key={[...curriculum.grades, ...curriculum.subjects]
              .map((x) => x.id)
              .join(",")}
            countryId={country.id}
            programs={programs}
            grades={curriculum.grades}
            subjects={curriculum.subjects}
            canWrite={canWrite}
          />
        </Card>
        <Card
          title={t("curriculum.grades")}
          subtitle={t("curriculum.gradesHint")}
        >
          <GradeList
            countryId={country.id}
            grades={curriculum.grades}
            canWrite={canWrite}
          />
        </Card>
        {canWrite ? (
          <Card title={t("curriculum.countrySettings")}>
            <CountryForm country={country} />
          </Card>
        ) : null}
      </div>
    </>
  );
}
