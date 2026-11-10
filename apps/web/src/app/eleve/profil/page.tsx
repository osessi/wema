import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@wema/ui/components/ui/card";
import { Progress } from "@wema/ui/components/ui/progress";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EasyReadingSwitch } from "../../../components/learner/easy-reading";
import { PreferencesForm } from "../../../components/learner/preferences-form";
import { StatusBadge } from "../../../components/learner/status-badge";
import { PageHeader } from "../../../components/page-header";
import { load, serverApi } from "../../../lib/api-server";
import { hypothesisBadge, shownStatus } from "../../../lib/hypothesis";

const INTEREST = "interest:";

export default async function Page() {
  const t = await getTranslations("learner");
  const api = await serverApi();
  const profile = await load(api.learner.profile.$get());
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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-xl">
              {t("profile.understood")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {profile.hypotheses.length === 0 ? (
              <div className="space-y-3">
                <p className="text-muted-foreground">
                  {t("profile.noHypotheses")}
                </p>
                <Button asChild>
                  <Link href="/eleve/prof-ia?mode=intake">
                    {t("profile.startIntake")}
                  </Link>
                </Button>
              </div>
            ) : (
              <ul className="space-y-4">
                {profile.hypotheses.map((h) => (
                  <li key={h.key} className="space-y-2 rounded-lg border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{label(h.key, h.statement)}</p>
                      <Badge variant={hypothesisBadge[shownStatus(h)]}>
                        {t(`profile.hypothesisStatus.${shownStatus(h)}`)}
                      </Badge>
                    </div>
                    <Progress
                      value={percent(h.confidence)}
                      aria-label={t("profile.confidence", {
                        value: percent(h.confidence),
                      })}
                    />
                    <p className="text-sm text-muted-foreground">
                      {t("profile.confidence", {
                        value: percent(h.confidence),
                      })}
                      {" · "}
                      {t("profile.sourceLabel", {
                        sources: h.sources
                          .map((s) => t(`profile.sources.${s}`))
                          .join(", "),
                      })}
                      {" · "}
                      {t("profile.evidence", { count: h.evidenceCount })}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-xl">
              {t("profile.preferences")}
            </CardTitle>
            <CardDescription>{t("profile.preferencesHelp")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <PreferencesForm active={active} interests={interests} />
            <EasyReadingSwitch />
          </CardContent>
        </Card>
      </div>

      {profile.needs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-xl">
              {t("profile.needs")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5">
              {profile.needs.map((n) => (
                <li key={n.id}>{n.adaptation}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold">
          {t("profile.notions")}
        </h2>
        {profile.notions.length === 0 ? (
          <p className="text-muted-foreground">{t("profile.noNotions")}</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {profile.notions.map((n) => (
              <li
                key={n.notionId}
                className="space-y-2 rounded-xl border bg-card p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {n.name ?? t("common.notionUnknown")}
                    {n.subject && (
                      <span className="text-muted-foreground">
                        {" "}
                        · {n.subject}
                      </span>
                    )}
                  </p>
                  <StatusBadge status={n.status} />
                </div>
                <p className="text-sm text-muted-foreground">
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
                    <p key={m.misconceptionId} className="text-sm">
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
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
