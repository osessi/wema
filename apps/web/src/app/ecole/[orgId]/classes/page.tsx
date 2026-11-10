import {
  ArrowRight,
  ChalkboardTeacher,
  Lightning,
  Plus,
  Student,
} from "@phosphor-icons/react/ssr";
import { GlowTile } from "@wema/ui/components/brand/glow-tile";
import { Badge } from "@wema/ui/components/ui/badge";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import { ProgressRing } from "@wema/ui/components/wema/progress-ring";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "../../../../components/page-header";
import { CreateClassForm } from "../../../../components/school/create-class-form";
import { loadPrograms } from "../../../../components/school/programs";
import { getSchool } from "../../../../components/school/school-context";
import { SectionTitle } from "../../../../components/school/section-title";
import { tryLoad } from "../../../../components/school/try-load";
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
  const org = api.admin.organizations[":id"];
  const [{ classes }, programs, overview] = await Promise.all([
    load(org.classes.$get({ param: { id: orgId } })),
    loadPrograms(),
    tryLoad(org.overview.$get({ param: { id: orgId } })),
  ]);
  const labels = new Map(programs.map((p) => [p.id, p.label]));
  const stats = new Map(
    (overview?.classes ?? []).map((k) => [k.classId, k] as const),
  );
  const visible = classes.filter((k) => !k.archived);

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
          icon={<ChalkboardTeacher weight="fill" />}
          tone="sky"
          titleAs="h2"
          title={t("none")}
          description={t("noneHint")}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((k) => {
            const s = stats.get(k.id);
            const mastered =
              s?.masteredShare != null ? Math.round(s.masteredShare * 100) : 0;
            const program = k.programId
              ? (labels.get(k.programId) ?? t("unknownProgram"))
              : null;
            return (
              <li key={k.id} className="h-full">
                <Link
                  href={`/ecole/${orgId}/classes/${k.id}`}
                  className="group flex h-full flex-col gap-4 rounded-card border bg-card p-4 shadow-xs transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <GlowTile tone="sky" size={40}>
                        <ChalkboardTeacher weight="fill" />
                      </GlowTile>
                      <div className="min-w-0 space-y-1">
                        <h2 className="truncate text-base font-semibold tracking-tight">
                          {k.name}
                        </h2>
                        {program ? (
                          <p className="truncate font-mono text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                            {program}
                          </p>
                        ) : (
                          <Badge variant="neutral">{t("noProgram")}</Badge>
                        )}
                      </div>
                    </div>
                    <ProgressRing
                      value={mastered}
                      label={t("masteredLabel", { name: k.name })}
                      size={48}
                      thickness={5}
                      tone="mint"
                      className="text-xs font-medium tabular-nums"
                    />
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-3 border-t pt-3 text-sm">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Student aria-hidden className="size-4" />
                        <span className="tabular-nums">
                          {t("learners", { count: s?.learners ?? 0 })}
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Lightning aria-hidden className="size-4" />
                        <span className="tabular-nums">
                          {t("active", { count: s?.activeThisWeek ?? 0 })}
                        </span>
                      </span>
                    </div>
                    <ArrowRight
                      aria-hidden
                      className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                    />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <section className="space-y-5 rounded-card border bg-card p-4 shadow-xs sm:p-6">
        <SectionTitle
          eyebrow={t("newEyebrow")}
          title={t("new")}
          icon={<Plus weight="bold" />}
          tone="yellow"
        />
        <CreateClassForm organizationId={orgId} programs={programs} />
      </section>
    </div>
  );
}
