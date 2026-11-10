import {
  Brain,
  HandHeart,
  Path,
  Sliders,
  Sparkle,
  Warning,
} from "@phosphor-icons/react/ssr";
import { GlowTile } from "@wema/ui/brand";
import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@wema/ui/components/ui/card";
import { FieldSection } from "@wema/ui/components/ui/field";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import { NotionStatus } from "@wema/ui/components/wema/notion-status";
import { ProgressRing } from "@wema/ui/components/wema/progress-ring";
import { SubjectLabel } from "@wema/ui/components/wema/subject-icon";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EasyReadingSwitch } from "../../../components/learner/easy-reading";
import { PreferencesForm } from "../../../components/learner/preferences-form";
import { TutorPersonaPicker } from "../../../components/learner/tutor-persona-picker";
import { PageHeader } from "../../../components/page-header";
import { load, serverApi } from "../../../lib/api-server";
import { hypothesisBadge, shownStatus } from "../../../lib/hypothesis";

const INTEREST = "interest:";

/** Teinte de la coque d'une notion, selon son statut. */
const NOTION_SHELL = {
  mastered: "mint",
  in_progress: "brand",
  needs_work: "rose",
  not_seen: "neutral",
} as const;

export default async function Page() {
  const t = await getTranslations("learner");
  const api = await serverApi();
  const [profile, persona] = await Promise.all([
    load(api.learner.profile.$get()),
    load(api.learner["tutor-persona"].$get({ query: {} })),
  ]);
  const percent = (v: number) => Math.round(v * 100);

  const label = (key: string, statement: string) =>
    t.has(`profile.prefs.${key}`) ? t(`profile.prefs.${key}`) : statement;
  const active = profile.hypotheses
    .filter((h) => h.status === "supported")
    .map((h) => h.key);
  const interests = profile.hypotheses
    .filter((h) => h.status === "supported" && h.key.startsWith(INTEREST))
    .map((h) => h.key.slice(INTEREST.length));

  return (
    <>
      <PageHeader
        title={t("profile.title")}
        description={t("profile.description")}
      />

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card tone="sky">
          <CardHeader>
            <div className="flex items-center gap-3">
              <GlowTile tone="sky" size={36}>
                <Brain weight="fill" />
              </GlowTile>
              <CardTitle className="text-lg">
                {t("profile.understood")}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {profile.hypotheses.length === 0 ? (
              <EmptyState
                variant="inline"
                tone="amber"
                icon={<Sparkle weight="fill" />}
                title={t("profile.noHypotheses")}
                action={
                  <Button asChild>
                    <Link href="/eleve/prof-ia?mode=intake">
                      {t("profile.startIntake")}
                    </Link>
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y">
                {profile.hypotheses.map((h) => (
                  <li
                    key={h.key}
                    className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <ProgressRing
                      value={percent(h.confidence)}
                      size={44}
                      thickness={4}
                      tone={shownStatus(h) === "supported" ? "mint" : "ink"}
                      label={t("profile.confidence", {
                        value: percent(h.confidence),
                      })}
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium">
                          {label(h.key, h.statement)}
                        </p>
                        <Badge variant={hypothesisBadge[shownStatus(h)]}>
                          {t(`profile.hypothesisStatus.${shownStatus(h)}`)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t("profile.sourceLabel", {
                          sources: h.sources
                            .map((s) => t(`profile.sources.${s}`))
                            .join(", "),
                        })}
                        {" · "}
                        {t("profile.evidence", { count: h.evidenceCount })}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <FieldSection
          tone="brand"
          title={t("profile.preferences")}
          description={t("profile.preferencesHelp")}
          icon={
            <GlowTile tone="yellow" size={36}>
              <Sliders weight="fill" />
            </GlowTile>
          }
        >
          <PreferencesForm active={active} interests={interests} />
          <EasyReadingSwitch />
        </FieldSection>
      </div>

      <FieldSection
        id="prof-ia"
        style={{ scrollMarginTop: "6rem" }}
        tone="rose"
        title={t("persona.title")}
        description={t("persona.profileHelp")}
        icon={
          <GlowTile tone="rose" size={36}>
            <Sparkle weight="fill" />
          </GlowTile>
        }
      >
        <TutorPersonaPicker
          initial={persona.current}
          subjects={persona.subjects}
          personas={persona.personas}
        />
      </FieldSection>

      {profile.needs.length > 0 && (
        <Card tone="rose">
          <CardHeader>
            <div className="flex items-center gap-3">
              <GlowTile tone="rose" size={36}>
                <HandHeart weight="fill" />
              </GlowTile>
              <CardTitle className="text-lg">{t("profile.needs")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {profile.needs.map((n) => (
                <li key={n.id} className="flex items-start gap-2">
                  <span
                    aria-hidden
                    className="mt-2 size-1.5 shrink-0 rounded-full bg-rose-ink"
                  />
                  {n.adaptation}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <section className="space-y-3">
        <h2 className="font-mono text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          {t("profile.notions")}
        </h2>
        {profile.notions.length === 0 ? (
          <EmptyState
            icon={<Path weight="fill" />}
            tone="mint"
            title={t("profile.noNotions")}
            action={
              <Button asChild variant="outline">
                <Link href="/eleve/exercices">{t("exercises.toList")}</Link>
              </Button>
            }
          />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {profile.notions.map((n) => (
              <li key={n.notionId} className="min-w-0">
                <Card
                  tone={NOTION_SHELL[n.status]}
                  className="h-full gap-2 p-4 sm:p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium">
                        {n.name ?? t("common.notionUnknown")}
                      </p>
                      {n.subject && (
                        <SubjectLabel
                          icon={n.subjectIcon}
                          size={20}
                          className="text-sm text-muted-foreground"
                        >
                          {n.subject}
                        </SubjectLabel>
                      )}
                    </div>
                    <NotionStatus
                      status={n.status}
                      label={t(`status.${n.status}`)}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground tabular-nums">
                    {t("progress.mastery", { value: percent(n.mastery) })}
                    {" · "}
                    {t("profile.recentAnswers", {
                      count: n.recentAnswers.length,
                      correct: n.recentAnswers.filter((a) => a.correct).length,
                    })}
                  </p>
                  {n.misconceptions.map((m) => {
                    const ai = m.evidence.find(
                      (e) =>
                        e.misconceptionSource === "ai" &&
                        e.misconceptionConfidence !== null,
                    );
                    return (
                      <p
                        key={m.misconceptionId}
                        className="flex items-start gap-2 rounded-control bg-warning-soft px-3 py-2 text-sm"
                      >
                        <Warning
                          aria-hidden
                          weight="fill"
                          className="mt-0.5 size-3.5 shrink-0 text-warning-text"
                        />
                        <span>
                          {m.description
                            ? t("profile.misconception", {
                                description: m.description,
                              })
                            : t("profile.misconceptionUnknown")}
                          <span className="text-muted-foreground">
                            {" · "}
                            {t("profile.misconceptionCount", {
                              count: m.occurrences,
                            })}
                            {ai?.misconceptionConfidence != null &&
                              ` · ${t("profile.aiDetected", {
                                value: percent(ai.misconceptionConfidence),
                              })}`}
                          </span>
                        </span>
                      </p>
                    );
                  })}
                  {n.assessments.map((a) => (
                    <p
                      key={a.sessionId}
                      className="text-sm text-muted-foreground"
                    >
                      {t("profile.assessment.line", {
                        kind: t(`profile.assessment.${a.kind}`),
                        understanding: percent(a.understanding),
                      })}
                      {a.summary ? ` · ${a.summary}` : ""}
                    </p>
                  ))}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
