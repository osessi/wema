import { Plus } from "@phosphor-icons/react/ssr";
import { GlowTile } from "@wema/ui/components/brand/glow-tile";
import { ILLUSTRATION_FOR } from "@wema/ui/components/illustrations/usages";
import { Badge } from "@wema/ui/components/ui/badge";
import { FieldSection } from "@wema/ui/components/ui/field";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "../../../../components/page-header";
import {
  ClassCardGrid,
  loadClassCards,
} from "../../../../components/school/class-cards";
import { CreateClassForm } from "../../../../components/school/create-class-form";
import { loadPrograms } from "../../../../components/school/programs";
import { getSchool } from "../../../../components/school/school-context";
import { load, serverApi } from "../../../../lib/api-server";

export default async function Page({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const { school, can } = await getSchool(orgId);
  if (!can("classes.manage")) notFound();
  const t = await getTranslations("school.classes");
  const api = await serverApi();
  const [{ classes: overview }, programs] = await Promise.all([
    load(
      api.admin.organizations[":id"].overview.$get({ param: { id: orgId } }),
    ),
    loadPrograms(),
  ]);
  const visible = await loadClassCards(orgId, overview, true);

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("title")}
        description={t("subtitle", { name: school.name })}
        actions={
          <Badge variant="info" className="tabular-nums">
            {t("count", { count: visible.length })}
          </Badge>
        }
      />
      {visible.length === 0 ? (
        <EmptyState
          illustration={ILLUSTRATION_FOR.emptyClasses}
          titleAs="h2"
          title={t("none")}
          description={t("noneHint")}
        />
      ) : (
        <ClassCardGrid orgId={orgId} classes={visible} manage />
      )}
      <FieldSection
        tone="brand"
        title={<h2 className="text-base font-semibold">{t("new")}</h2>}
        description={t("newHint")}
        icon={
          <GlowTile tone="yellow" size={36}>
            <Plus weight="bold" />
          </GlowTile>
        }
      >
        <CreateClassForm organizationId={orgId} programs={programs} />
      </FieldSection>
    </div>
  );
}
