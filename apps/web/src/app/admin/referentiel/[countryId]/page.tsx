import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@wema/ui/components/ui/card";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "../../../../components/page-header";
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
      <Link
        href="/admin/referentiel"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        {t("curriculum.title")}
      </Link>
      <PageHeader
        title={`${country.name} (${country.code})`}
        description={country.unitLabel.plural}
      />
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">
              {t("curriculum.programs")}
            </CardTitle>
            <CardDescription>{t("curriculum.programsHint")}</CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">
              {t("curriculum.grades")}
            </CardTitle>
            <CardDescription>{t("curriculum.gradesHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <GradeList
              countryId={country.id}
              grades={curriculum.grades}
              canWrite={canWrite}
            />
          </CardContent>
        </Card>
        {canWrite ? (
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">
                {t("curriculum.countrySettings")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CountryForm country={country} />
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}
