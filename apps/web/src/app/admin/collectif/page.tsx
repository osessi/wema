import { Badge } from "@wema/ui/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@wema/ui/components/ui/card";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { PageHeader } from "../../../components/page-header";
import { load, serverApi } from "../../../lib/api-server";
import type { CollectiveInsight } from "../../../lib/insights-types";
import { EmptyState } from "../_ui/fields";
import { ComputeButton } from "./compute-button";

const FORMATS = new Set(["text", "easy_reading", "diagram", "comics", "audio"]);

export default async function CollectivePage({
  searchParams,
}: {
  searchParams: Promise<{ pays?: string }>;
}) {
  const { pays } = await searchParams;
  const t = await getTranslations("insights");
  const format = await getFormatter();
  const api = await serverApi();
  const [data, { countries }] = await Promise.all([
    load(
      api.admin.collective.$get({
        query: pays ? { countryId: pays } : {},
      }),
    ),
    load(api.admin.curriculum.countries.$get()),
  ]);
  const pct = (x: number) => format.number(x, { style: "percent" });
  const formatName = (f: { format: string; scaffolded: boolean | null }) => {
    const base = FORMATS.has(f.format)
      ? t(`formats.${f.format}`)
      : t("formats.other", { format: f.format });
    return f.scaffolded === null
      ? base
      : `${base}, ${t(f.scaffolded ? "formats.guided" : "formats.plain")}`;
  };
  const gain = (g: number | null) =>
    g === null
      ? t("collective.none")
      : t("collective.gain", {
          gain: `${g >= 0 ? "+" : ""}${Math.round(g * 100)}`,
        });

  const notionCard = (i: CollectiveInsight) => (
    <Card key={i.notionId} className="shadow-none">
      <CardHeader>
        <CardTitle className="font-display text-lg">{i.notionName}</CardTitle>
        <CardDescription>
          {i.countryName} · {i.gradeName} · {i.subjectName} ·{" "}
          {t("collective.learners", { count: i.learners })}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-3">
        <dl className="grid grid-cols-2 gap-3 text-sm lg:col-span-3 lg:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">{t("collective.success")}</dt>
            <dd className="font-medium">{pct(i.successRate)}</dd>
          </div>
          <div>
            <dt
              className="text-muted-foreground"
              title={t("collective.stuckHint")}
            >
              {t("collective.stuck")}
            </dt>
            <dd className="font-medium">{pct(i.stuckRate)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">
              {t("collective.toSuccess")}
            </dt>
            <dd className="font-medium">
              {i.avgAnswersToSuccess ?? t("collective.none")}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">
              {t("collective.tutorTime")}
            </dt>
            <dd className="font-medium">
              {i.avgTutorSeconds === null
                ? t("collective.none")
                : t("collective.minutes", {
                    count: Math.max(1, Math.round(i.avgTutorSeconds / 60)),
                  })}
            </dd>
          </div>
        </dl>
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">
            {t("collective.misconceptions")}
          </h3>
          {i.misconceptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("collective.noMisconception")}
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {i.misconceptions.map((m) => (
                <li key={m.misconceptionId} className="rounded-lg border p-2">
                  {m.description}
                  <span className="block text-xs text-muted-foreground">
                    {t("collective.share", { share: pct(m.share) })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">{t("collective.formats")}</h3>
          {i.formats.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("collective.noFormat")}
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {i.formats.map((f) => (
                <li
                  key={`${f.format}-${String(f.scaffolded)}`}
                  className="flex items-center justify-between gap-2 rounded-lg border p-2"
                >
                  <span>
                    {formatName(f)}
                    <span className="block text-xs text-muted-foreground">
                      {t("collective.learners", { count: f.learners })}
                      {f.nextSuccessRate !== null &&
                        ` · ${t("collective.nextSuccess", { rate: pct(f.nextSuccessRate) })}`}
                    </span>
                  </span>
                  <Badge variant="outline">{gain(f.gain)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">{t("collective.exercises")}</h3>
          {i.exercises.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("collective.noExercise")}
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {i.exercises.map((e) => (
                <li
                  key={e.intentId}
                  className="flex items-center justify-between gap-2 rounded-lg border p-2"
                >
                  <span>
                    {e.objective}
                    <span className="block text-xs text-muted-foreground">
                      {t("collective.learners", { count: e.learners })}
                    </span>
                  </span>
                  <Badge variant="outline">{gain(e.gain)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>
      </CardContent>
    </Card>
  );

  return (
    <>
      <PageHeader
        title={t("collective.title")}
        description={t("collective.subtitle", { min: data.minLearners })}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {data.computedAt
            ? t("collective.computedAt", {
                date: format.dateTime(new Date(data.computedAt), {
                  dateStyle: "medium",
                  timeStyle: "short",
                }),
              })
            : t("collective.neverComputed")}
        </p>
        <ComputeButton />
      </div>
      <nav
        aria-label={t("collective.country")}
        className="flex flex-wrap gap-2 text-sm"
      >
        {[{ id: "", name: t("collective.allCountries") }, ...countries].map(
          (c) => (
            <Link
              key={c.id || "all"}
              href={c.id ? `/admin/collectif?pays=${c.id}` : "/admin/collectif"}
              aria-current={(pays ?? "") === c.id ? "page" : undefined}
              className="rounded-full border px-3 py-1 hover:bg-muted aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
            >
              {c.name}
            </Link>
          ),
        )}
      </nav>
      {data.insights.length === 0 ? (
        <EmptyState>
          {t("collective.empty", { min: data.minLearners })}
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-4">
          {data.insights.map(notionCard)}
        </div>
      )}
    </>
  );
}
