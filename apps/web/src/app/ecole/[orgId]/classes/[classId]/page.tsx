import { ArrowLeft, MapTrifold, UsersThree } from "@phosphor-icons/react/ssr";
import { Button } from "@wema/ui/components/ui/button";
import { Card } from "@wema/ui/components/ui/card";
import { PersonStack } from "@wema/ui/components/wema/person-avatar";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "../../../../../components/page-header";
import { ClassMapView } from "../../../../../components/school/class-map";
import { ClassMembersPanel } from "../../../../../components/school/class-members";
import { loadPrograms } from "../../../../../components/school/programs";
import { getSchool } from "../../../../../components/school/school-context";
import { SectionTitle } from "../../../../../components/school/section-title";
import { tryLoad } from "../../../../../components/school/try-load";
import { load, serverApi } from "../../../../../lib/api-server";

export default async function Page({
  params,
}: {
  params: Promise<{ orgId: string; classId: string }>;
}) {
  const { orgId, classId } = await params;
  const { can } = await getSchool(orgId);
  if (!can("classes.manage")) notFound();
  const t = await getTranslations("school.classDetail");
  const api = await serverApi();
  const klass = api.admin.classes[":id"];
  const detail = await tryLoad(klass.$get({ param: { id: classId } }));
  if (!detail || detail.class.organizationId !== orgId) notFound();
  const [map, membersBody, programs] = await Promise.all([
    load(klass.map.$get({ param: { id: classId } })),
    tryLoad(
      api.admin.organizations[":id"].members.$get({ param: { id: orgId } }),
    ),
    loadPrograms(),
  ]);
  const candidates = membersBody?.members ?? null;
  const program = programs.find((p) => p.id === detail.class.programId);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={program?.label ?? t("noProgram")}
        title={detail.class.name}
        description={t("subtitle", {
          teachers: detail.members.filter((m) => m.role === "teacher").length,
          learners: detail.members.filter((m) => m.role === "learner").length,
        })}
        actions={
          <>
            {detail.members.length > 0 && (
              <PersonStack
                people={detail.members.map((m) => ({
                  id: m.userId,
                  name: m.displayName,
                }))}
                max={6}
                size="default"
              />
            )}
            <Button asChild variant="outline">
              <Link href={`/ecole/${orgId}/classes`}>
                <ArrowLeft aria-hidden />
                {t("back")}
              </Link>
            </Button>
          </>
        }
      />
      <section className="space-y-4">
        <SectionTitle
          title={t("membersTitle")}
          icon={<UsersThree weight="fill" />}
          tone="sky"
        />
        <ClassMembersPanel
          classId={classId}
          members={detail.members}
          candidates={candidates}
        />
      </section>
      <Card tone="mint" className="gap-5 px-4 py-4 sm:px-6 sm:py-6">
        <SectionTitle
          title={t("mapTitle")}
          description={t("mapText")}
          icon={<MapTrifold weight="fill" />}
          tone="mint"
        />
        <ClassMapView map={map} />
      </Card>
    </div>
  );
}
