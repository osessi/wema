import {
  ArrowCounterClockwise,
  ChartLineUp,
  ChatCircleText,
  CheckCircle,
  Circle,
  CircleHalf,
  Lightbulb,
  Seal,
  ShieldCheck,
  Student,
} from "@phosphor-icons/react/ssr";
import { GlowTile } from "@wema/ui/brand";
import { Badge } from "@wema/ui/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@wema/ui/components/ui/breadcrumb";
import { Button } from "@wema/ui/components/ui/button";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import { StatTile } from "@wema/ui/components/wema/stat-tile";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "../../../../../components/page-header";
import { isSuccess } from "../../../../../components/teacher/data";
import { PreferenceForm } from "../../../../../components/teacher/preference-form";
import { SectionHeading } from "../../../../../components/teacher/section";
import { StatusBadge } from "../../../../../components/teacher/status";
import { load, serverApi } from "../../../../../lib/api-server";
import { hypothesisBadge, shownStatus } from "../../../../../lib/hypothesis";
import { getSpaces } from "../../../../../lib/spaces";
import { needsOf, type ProfileNotion } from "../../../../../lib/teacher-types";

const pct = (n: number) => Math.round(n * 100);

function Answers({
  answers,
  labels,
}: {
  answers: ProfileNotion["recentAnswers"];
  labels: { list: string; correct: string; notYet: string };
}) {
  if (answers.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label={labels.list}>
      {answers.map((a) => (
        <li key={`${a.at}-${a.response}`}>
          <Badge
            variant={a.correct ? "success" : "warning"}
            title={a.response ?? undefined}
          >
            {a.correct ? (
              <CheckCircle weight="bold" className="size-3" />
            ) : (
              <Circle weight="bold" className="size-3" />
            )}
            {a.correct ? labels.correct : labels.notYet}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

export default async function LearnerPage({
  params,
}: {
  params: Promise<{ orgId: string; userId: string }>;
}) {
  const { orgId, userId } = await params;
  const t = await getTranslations("teacher.learner");
  const api = await serverApi();
  const res = await api.admin.organizations[":id"].learners[
    ":userId"
  ].profile.$get({ param: { id: orgId, userId } });
  if (res.status === 404 || res.status === 403) notFound();
  const profile = await load(Promise.resolve(res));

  // Nom et classe : parmi les classes où l'utilisateur enseigne.
  const { mine, session } = await getSpaces();
  let name: string | null = null;
  let klass: { id: string; name: string } | null = null;
  for (const k of mine.teaching.filter((c) => c.organizationId === orgId)) {
    const detail = await api.admin.classes[":id"].$get({ param: { id: k.id } });
    if (!isSuccess(detail)) continue;
    const member = (await detail.json()).members.find(
      (m) => m.userId === userId && m.role === "learner",
    );
    if (member) {
      name = member.displayName;
      klass = { id: k.id, name: k.name };
      break;
    }
  }
  const permissions =
    session.organizations.find((o) => o.id === orgId)?.permissions ?? [];
  const canWrite = permissions.includes("learners.write");
  const needs = needsOf(profile);
  const notions = [...profile.notions].sort((a, b) =>
    (a.name ?? "").localeCompare(b.name ?? ""),
  );
  const counts = { mastered: 0, in_progress: 0, needs_work: 0, not_seen: 0 };
  for (const n of notions) counts[n.status] += 1;
  const average =
    notions.length === 0
      ? 0
      : notions.reduce((s, n) => s + n.mastery, 0) / notions.length;

  return (
    <>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/prof">{t("breadcrumb")}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          {klass && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href={`/prof/classes/${klass.id}?tab=learners`}>
                    {klass.name}
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
            </>
          )}
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{name ?? t("unnamed")}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <PageHeader
        eyebrow={klass ? `${t("eyebrow")} · ${klass.name}` : t("eyebrow")}
        title={name ?? t("unnamed")}
        description={t("description")}
        actions={
          <Button asChild variant="outline">
            <Link href="/prof/messages">
              <ChatCircleText />
              {t("write")}
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label={t("statMastered")}
          value={counts.mastered}
          icon={<Seal weight="fill" />}
          tone="mint"
          hint={t("statOf", { total: notions.length })}
        />
        <StatTile
          label={t("statInProgress")}
          value={counts.in_progress}
          icon={<CircleHalf weight="fill" />}
          tone="yellow"
        />
        <StatTile
          label={t("statNeedsWork")}
          value={counts.needs_work}
          icon={<ArrowCounterClockwise weight="bold" />}
          tone={counts.needs_work > 0 ? "rose" : "slate"}
        />
        <StatTile
          label={t("statMastery")}
          value={average}
          format={{ style: "percent" }}
          icon={<ChartLineUp weight="fill" />}
          tone="sky"
        />
      </div>

      <section className="space-y-4" aria-labelledby="progress-title">
        <SectionHeading
          id="progress-title"
          eyebrow={t("progressEyebrow")}
          title={t("progressTitle")}
        />
        {notions.length === 0 ? (
          <EmptyState
            icon={<Student weight="fill" />}
            tone="sky"
            title={t("progressTitle")}
            description={t("noActivity")}
          />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {notions.map((n) => (
              <li
                key={n.notionId}
                className="flex h-full min-w-0 flex-col gap-4 rounded-card border bg-card p-4 shadow-xs"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-medium leading-snug">
                      {n.name ?? t("unknownNotion")}
                    </h3>
                    {n.subject && (
                      <p className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
                        {n.subject}
                      </p>
                    )}
                  </div>
                  <StatusBadge status={n.status} />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="text-muted-foreground">
                      {t("mastery")}
                    </span>
                    <span className="font-medium tabular-nums">
                      {t("masteryValue", { value: pct(n.mastery) })}
                    </span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label={t("mastery")}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={pct(n.mastery)}
                    className="h-2 overflow-hidden rounded-full bg-muted"
                  >
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand to-status-mastered-ink"
                      style={{ width: `${pct(n.mastery)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("observations", { count: n.observations })}
                  </p>
                </div>
                {(n.recentAnswers.length > 0 ||
                  n.misconceptions.length > 0 ||
                  n.assessments.length > 0) && (
                  <div className="space-y-2 border-t pt-3">
                    <p className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
                      {t("evidence")}
                    </p>
                    <Answers
                      answers={n.recentAnswers}
                      labels={{
                        list: t("recentAnswers"),
                        correct: t("correct"),
                        notYet: t("notYet"),
                      }}
                    />
                    {n.misconceptions.map((m) => {
                      const ai = m.evidence.find(
                        (e) => e.misconceptionSource === "ai",
                      );
                      return (
                        <div
                          key={m.misconceptionId}
                          className="flex gap-2 rounded-lg bg-warning-soft/50 p-2.5 text-sm"
                        >
                          <Lightbulb
                            weight="fill"
                            aria-hidden
                            className="mt-0.5 size-4 shrink-0 text-warning-text"
                          />
                          <div className="min-w-0">
                            <span className="font-medium">
                              {m.description ?? t("unnamedMisconception")}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {t("misconceptionSeen", {
                                count: m.occurrences,
                              })}
                              {ai?.misconceptionConfidence != null &&
                                ` · ${t("aiDetected", {
                                  value: pct(ai.misconceptionConfidence),
                                })}`}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    {n.assessments.map((a) => (
                      <div
                        key={a.sessionId}
                        className="rounded-lg bg-info-soft/50 p-2.5 text-sm"
                      >
                        <span className="block text-xs text-muted-foreground">
                          {t(`assessment.${a.kind}`)} ·{" "}
                          {t("assessmentValues", {
                            understanding: pct(a.understanding),
                            confidence: pct(a.confidence),
                          })}
                        </span>
                        {a.summary}
                      </div>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="flex h-full min-w-0 flex-col gap-4 rounded-card border bg-card p-5 shadow-xs">
          <div className="flex items-start gap-3">
            <GlowTile tone="sky" size={40}>
              <Student weight="fill" />
            </GlowTile>
            <div className="min-w-0 space-y-1">
              <h2 className="font-semibold tracking-tight">
                {t("hypothesesTitle")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t("hypothesesHint")}
              </p>
            </div>
          </div>
          <div className="space-y-4">
            {profile.hypotheses.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("noHypothesis")}
              </p>
            ) : (
              <ul className="space-y-2">
                {profile.hypotheses.map((h) => (
                  <li
                    key={h.key}
                    className="rounded-lg border bg-background p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{h.statement}</span>
                      <Badge variant={hypothesisBadge[shownStatus(h)]}>
                        {t(`hypothesisStatus.${shownStatus(h)}`)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("hypothesisMeta", {
                        confidence: pct(h.confidence),
                        evidence: h.evidenceCount,
                      })}{" "}
                      · {h.sources.map((s) => t(`source.${s}`)).join(", ")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {canWrite && <PreferenceForm orgId={orgId} userId={userId} />}
          </div>
        </div>

        <div className="flex h-full min-w-0 flex-col gap-4 rounded-card border bg-card p-5 shadow-xs">
          <div className="flex items-start gap-3">
            <GlowTile tone="rose" size={40}>
              <ShieldCheck weight="fill" />
            </GlowTile>
            <div className="min-w-0 space-y-1">
              <h2 className="font-semibold tracking-tight">
                {t("needsTitle")}
              </h2>
              <p className="text-sm text-muted-foreground">{t("needsHint")}</p>
            </div>
          </div>
          <div>
            {needs === null ? (
              <p className="text-sm text-muted-foreground">
                {t("needsRestricted")}
              </p>
            ) : needs.filter((d) => d.active).length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noNeeds")}</p>
            ) : (
              <ul className="space-y-2">
                {needs
                  .filter((d) => d.active)
                  .map((d) => (
                    <li
                      key={d.id}
                      className="rounded-lg border bg-background p-3 text-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{d.label}</span>
                        <Badge
                          variant={
                            d.consent === "given" ? "success" : "warning"
                          }
                        >
                          {d.consent === "given"
                            ? t("consentGiven")
                            : t("consentPending")}
                        </Badge>
                      </div>
                      <p className="mt-1 text-muted-foreground">
                        {d.adaptation}
                      </p>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
