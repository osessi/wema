import { CheckCircle, Circle, ShieldCheck } from "@phosphor-icons/react/ssr";
import { Badge } from "@wema/ui/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@wema/ui/components/ui/breadcrumb";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@wema/ui/components/ui/card";
import { Progress } from "@wema/ui/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@wema/ui/components/ui/table";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "../../../../../components/page-header";
import { isSuccess } from "../../../../../components/teacher/data";
import { PreferenceForm } from "../../../../../components/teacher/preference-form";
import { StatusBadge } from "../../../../../components/teacher/status";
import { load, serverApi } from "../../../../../lib/api-server";
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
    <ul className="flex flex-wrap gap-1" aria-label={labels.list}>
      {answers.map((a) => (
        <li key={`${a.at}-${a.response}`}>
          <Badge
            variant="outline"
            className={a.correct ? "" : "bg-peach text-peach-ink"}
            title={a.response ?? undefined}
          >
            {a.correct ? <CheckCircle /> : <Circle />}
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
      <PageHeader title={name ?? t("unnamed")} description={t("description")} />

      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold">{t("progressTitle")}</h2>
        {notions.length === 0 ? (
          <Card className="shadow-none">
            <CardContent className="text-muted-foreground">
              {t("noActivity")}
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("notion")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead className="min-w-36">{t("mastery")}</TableHead>
                  <TableHead>{t("evidence")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notions.map((n) => (
                  <TableRow key={n.notionId} className="align-top">
                    <TableCell className="whitespace-normal">
                      <span className="font-medium">
                        {n.name ?? t("unknownNotion")}
                      </span>
                      {n.subject && (
                        <span className="block text-xs text-muted-foreground">
                          {n.subject}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={n.status} />
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <span className="text-sm">
                          {t("masteryValue", { value: pct(n.mastery) })}
                        </span>
                        <Progress
                          value={pct(n.mastery)}
                          aria-label={t("mastery")}
                        />
                        <span className="block text-xs text-muted-foreground">
                          {t("observations", { count: n.observations })}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="space-y-2 whitespace-normal">
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
                            className="rounded-lg border p-2 text-sm"
                          >
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
                        );
                      })}
                      {n.assessments.map((a) => (
                        <div
                          key={a.sessionId}
                          className="rounded-lg border p-2 text-sm"
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>{t("hypothesesTitle")}</CardTitle>
            <CardDescription>{t("hypothesesHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {profile.hypotheses.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("noHypothesis")}
              </p>
            ) : (
              <ul className="space-y-2">
                {profile.hypotheses.map((h) => (
                  <li key={h.key} className="rounded-lg border p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{h.statement}</span>
                      <Badge variant="outline">
                        {t(`hypothesisStatus.${h.status}`)}
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
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5" />
              {t("needsTitle")}
            </CardTitle>
            <CardDescription>{t("needsHint")}</CardDescription>
          </CardHeader>
          <CardContent>
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
                    <li key={d.id} className="rounded-lg border p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{d.label}</span>
                        <Badge variant="outline">
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
          </CardContent>
        </Card>
      </section>
    </>
  );
}
