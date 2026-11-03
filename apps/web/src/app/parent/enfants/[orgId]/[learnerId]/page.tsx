import { Button } from "@wema/ui/components/ui/button";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { HypothesesList } from "../../../../../components/guardian/hypotheses-list";
import { NeedsPanel } from "../../../../../components/guardian/needs-panel";
import { NotionProgress } from "../../../../../components/guardian/notion-progress";
import { PreferencesForm } from "../../../../../components/guardian/preferences-form";
import { Section } from "../../../../../components/guardian/section";
import { SharePanel } from "../../../../../components/guardian/share-panel";
import { PageHeader } from "../../../../../components/page-header";
import { tryLoad } from "../../../../../components/school/try-load";
import { load, serverApi } from "../../../../../lib/api-server";
import { readNeeds } from "../../../../../lib/guardian-types";

export default async function Page({
  params,
}: {
  params: Promise<{ orgId: string; learnerId: string }>;
}) {
  const { orgId, learnerId } = await params;
  const t = await getTranslations("guardian.profile");
  const api = await serverApi();
  const { children } = await load(api.parent.children.$get());
  const child = children.find(
    (c) => c.learnerId === learnerId && c.organizationId === orgId,
  );
  if (!child) notFound();

  const learner = api.admin.organizations[":id"].learners[":userId"];
  const param = { id: orgId, userId: learnerId };
  const [profile, sharesBody] = await Promise.all([
    load(learner.profile.$get({ param })),
    tryLoad(learner["health-shares"].$get({ param })),
  ]);
  // Le partage n'est proposé qu'au parent qui peut déclarer des besoins.
  const shares = sharesBody?.organizations ?? null;
  const needs = readNeeds(profile);
  const base = `/admin/organizations/${orgId}/learners/${learnerId}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={child.displayName}
        description={t("subtitle")}
        actions={
          <Button asChild variant="outline">
            <Link href="/parent">{t("back")}</Link>
          </Button>
        }
      />
      <Section title={t("understoodTitle")} description={t("understoodText")}>
        <HypothesesList hypotheses={profile.hypotheses} />
      </Section>
      <Section title={t("progressTitle")} description={t("progressText")}>
        <NotionProgress notions={profile.notions} />
      </Section>
      <Section title={t("preferencesTitle")} description={t("preferencesText")}>
        <PreferencesForm base={base} hypotheses={profile.hypotheses} />
      </Section>
      {needs && (
        <Section title={t("needsTitle")} description={t("needsText")}>
          <NeedsPanel base={base} needs={needs} />
        </Section>
      )}
      {shares && (
        <Section title={t("shareTitle")} description={t("shareText")}>
          <SharePanel base={base} organizations={shares} />
        </Section>
      )}
    </div>
  );
}
