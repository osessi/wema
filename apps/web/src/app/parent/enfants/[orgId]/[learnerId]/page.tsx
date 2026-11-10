import {
  ArrowCounterClockwise,
  ArrowLeft,
  Brain,
  CalendarDots,
  ChartLineUp,
  Check,
  CircleHalf,
  Heart,
  Lightbulb,
  ShareNetwork,
  ShieldCheck,
} from "@phosphor-icons/react/ssr";
import { Button } from "@wema/ui/components/ui/button";
import { StatTile } from "@wema/ui/components/wema/stat-tile";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { HypothesesList } from "../../../../../components/guardian/hypotheses-list";
import { NeedsPanel } from "../../../../../components/guardian/needs-panel";
import { NotionProgress } from "../../../../../components/guardian/notion-progress";
import { PreferencesForm } from "../../../../../components/guardian/preferences-form";
import { Section } from "../../../../../components/guardian/section";
import { SharePanel } from "../../../../../components/guardian/share-panel";
import { WeeklySummary } from "../../../../../components/guardian/weekly-summary";
import { DiagnosticReport } from "../../../../../components/onboarding/diagnostic-report";
import { PageHeader } from "../../../../../components/page-header";
import { tryLoad } from "../../../../../components/school/try-load";
import { load, serverApi } from "../../../../../lib/api-server";
import { readNeeds } from "../../../../../lib/guardian-types";
import { shownStatus } from "../../../../../lib/hypothesis";

export default async function Page({
  params,
}: {
  params: Promise<{ orgId: string; learnerId: string }>;
}) {
  const { orgId, learnerId } = await params;
  const t = await getTranslations("guardian.profile");
  const tWeek = await getTranslations("guardian.week");
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
  // Le partage n'est proposé qu'au parent qui peut déclarer des besoins, et
  // seulement si l'enfant appartient à une école (l'API renvoie alors la liste).
  const shares = sharesBody?.organizations ?? null;
  const needs = readNeeds(profile);
  const base = `/admin/organizations/${orgId}/learners/${learnerId}`;
  const count = (s: string) =>
    profile.notions.filter((n) => n.status === s).length;
  const supported = profile.hypotheses.filter(
    (h) => shownStatus(h) === "supported",
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={child.displayName}
        description={t("subtitle")}
        actions={
          <Button asChild variant="outline">
            <Link href="/parent">
              <ArrowLeft aria-hidden />
              {t("back")}
            </Link>
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label={t("statMastered")}
          value={count("mastered")}
          icon={<Check weight="bold" />}
          tone="mint"
        />
        <StatTile
          label={t("statInProgress")}
          value={count("in_progress")}
          icon={<CircleHalf weight="fill" />}
          tone="yellow"
        />
        <StatTile
          label={t("statNeedsWork")}
          value={count("needs_work")}
          icon={<ArrowCounterClockwise weight="bold" />}
          tone="rose"
        />
        <StatTile
          label={t("statHypotheses")}
          value={profile.hypotheses.length}
          icon={<Lightbulb weight="bold" />}
          tone="sky"
          hint={t("statHypothesesHint", { count: supported })}
        />
      </div>
      <Section
        eyebrow={tWeek("eyebrow")}
        icon={<CalendarDots weight="bold" />}
        tone="amber"
        title={tWeek("title")}
        description={tWeek("text")}
      >
        <WeeklySummary child={child} />
      </Section>
      <DiagnosticReport reports={profile.diagnostics} />
      <Section
        eyebrow={t("eyebrowUnderstood")}
        icon={<Brain weight="bold" />}
        tone="sky"
        title={t("understoodTitle")}
        description={t("understoodText")}
      >
        <HypothesesList hypotheses={profile.hypotheses} />
      </Section>
      <Section
        eyebrow={t("eyebrowProgress")}
        icon={<ChartLineUp weight="bold" />}
        tone="yellow"
        title={t("progressTitle")}
        description={t("progressText")}
      >
        <NotionProgress notions={profile.notions} />
      </Section>
      <Section
        eyebrow={t("eyebrowPreferences")}
        icon={<Heart weight="bold" />}
        tone="rose"
        title={t("preferencesTitle")}
        description={t("preferencesText")}
      >
        <PreferencesForm base={base} hypotheses={profile.hypotheses} />
      </Section>
      {needs && (
        <Section
          eyebrow={t("eyebrowNeeds")}
          icon={<ShieldCheck weight="bold" />}
          tone="mint"
          title={t("needsTitle")}
          description={t("needsText")}
        >
          <NeedsPanel base={base} needs={needs} />
        </Section>
      )}
      {shares && shares.length > 0 && (
        <Section
          eyebrow={t("eyebrowShare")}
          icon={<ShareNetwork weight="bold" />}
          tone="slate"
          title={t("shareTitle")}
          description={t("shareText")}
        >
          <SharePanel base={base} organizations={shares} />
        </Section>
      )}
    </div>
  );
}
