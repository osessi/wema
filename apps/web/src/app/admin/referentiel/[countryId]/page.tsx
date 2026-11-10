import {
  ArrowLeft,
  GearSix,
  GraduationCap,
  Stack,
} from "@phosphor-icons/react/dist/ssr";
import { Badge } from "@wema/ui/components/ui/badge";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "../../../../components/page-header";
import { load, serverApi } from "../../../../lib/api-server";
import { hasPermission } from "../../../../lib/session";
import { Panel } from "../../_ui/kit";
import { CountryForm } from "../country-form";
import { CurriculumTransfer } from "./curriculum-transfer";
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
  const programs = curriculum.programs.map((p) => {
    const notions = curriculum.notions.filter(
      (n) => !n.archived && unitIdsByProgram.get(p.id)?.has(n.unitId),
    );
    return {
      ...p,
      notionCount: notions.length,
      verifiedCount: notions.filter((n) => n.verified).length,
    };
  });
  const activeNotions = curriculum.notions.filter((n) => !n.archived);
  const pending = activeNotions.filter((n) => !n.verified).length;

  return (
    <>
      <div className="flex flex-col gap-4">
        <Link
          href="/admin/referentiel"
          className="inline-flex w-fit items-center gap-1.5 rounded-md text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <ArrowLeft aria-hidden className="size-3.5" />
          {t("curriculum.title")}
        </Link>
        <div className="flex items-start gap-4">
          <span
            aria-hidden
            className="mt-1 hidden h-14 min-w-14 place-items-center rounded-[12px] bg-foreground px-2 font-mono text-2xl font-medium tracking-[0.04em] text-background sm:grid"
          >
            {country.code}
          </span>
          <div className="min-w-0 flex-1 space-y-3">
            <PageHeader
              title={`${country.name} (${country.code})`}
              description={country.unitLabel.plural}
              eyebrow={t("curriculum.title")}
            />
            <div className="flex flex-wrap items-center gap-2">
              {country.archived ? (
                <Badge variant="neutral">{t("common.archived")}</Badge>
              ) : null}
              <Badge variant="neutral" className="tabular-nums">
                {t("curriculum.notionsCount", { count: activeNotions.length })}
              </Badge>
              {pending > 0 ? (
                <Badge variant="warning" className="tabular-nums">
                  {t("curriculum.pendingCount", { count: pending })}
                </Badge>
              ) : activeNotions.length > 0 ? (
                <Badge variant="success">{t("curriculum.allVerified")}</Badge>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      <Panel
        icon={<Stack weight="fill" />}
        tone="sky"
        title={t("curriculum.programs")}
        description={t("curriculum.programsHint")}
        flush
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
      </Panel>
      <Panel
        icon={<GraduationCap weight="fill" />}
        tone="mint"
        title={t("curriculum.grades")}
        description={t("curriculum.gradesHint")}
        flush
      >
        <GradeList
          countryId={country.id}
          grades={curriculum.grades}
          canWrite={canWrite}
        />
      </Panel>
      <CurriculumTransfer countryId={country.id} canWrite={canWrite} />
      {canWrite ? (
        <Panel
          icon={<GearSix weight="fill" />}
          tone="slate"
          title={t("curriculum.countrySettings")}
        >
          <CountryForm country={country} />
        </Panel>
      ) : null}
    </>
  );
}
