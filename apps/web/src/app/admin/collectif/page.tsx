import {
  ChartLineUp,
  Clock,
  Lightbulb,
  ShieldCheck,
  Warning,
} from "@phosphor-icons/react/dist/ssr";
import { Badge } from "@wema/ui/components/ui/badge";
import { Card } from "@wema/ui/components/ui/card";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import { StatTile } from "@wema/ui/components/wema/stat-tile";
import { cn } from "@wema/ui/lib/utils";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { PageHeader } from "../../../components/page-header";
import { load, serverApi } from "../../../lib/api-server";
import type { CollectiveInsight } from "../../../lib/insights-types";
import { MonoLabel } from "../_ui/kit";
import { ComputeButton } from "./compute-button";

const FORMATS = new Set(["text", "easy_reading", "diagram", "comics", "audio"]);

/** Gain en points : vert s'il fait progresser, rouge s'il fait reculer. */
function GainBadge({ gain, label }: { gain: number | null; label: string }) {
  const variant =
    gain === null
      ? "neutral"
      : gain > 0.005
        ? "success"
        : gain < -0.005
          ? "danger"
          : "neutral";
  return (
    <Badge variant={variant} className="shrink-0 tabular-nums">
      {label}
    </Badge>
  );
}

function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: string | undefined;
  tone?: "warning" | undefined;
}) {
  return (
    <div className="space-y-1 rounded-lg border bg-muted/30 px-3 py-2.5">
      <dt
        className="font-mono text-[10.5px] tracking-[0.06em] text-muted-foreground uppercase"
        title={hint}
      >
        {label}
      </dt>
      <dd
        className={cn(
          "text-lg font-light tabular-nums",
          tone === "warning" && "text-peach-ink",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

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
  const pct = (x: number) =>
    format.number(x, { style: "percent", maximumFractionDigits: 0 });
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

  const sectionList = (
    title: string,
    empty: string,
    items: { key: string; body: ReactNode; side?: ReactNode }[],
  ) => (
    <section className="flex min-w-0 flex-col gap-2">
      <MonoLabel>{title}</MonoLabel>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {items.map((i) => (
            <li
              key={i.key}
              className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2"
            >
              <span className="min-w-0">{i.body}</span>
              {i.side}
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  const notionCard = (i: CollectiveInsight) => (
    <Card key={i.notionId} className="gap-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className="text-base font-semibold tracking-tight">
            {i.notionName}
          </h2>
          <p className="text-sm text-muted-foreground">
            {i.countryName} · {i.gradeName} · {i.subjectName}
          </p>
        </div>
        <Badge variant="info" className="tabular-nums">
          {t("collective.learners", { count: i.learners })}
        </Badge>
      </div>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label={t("collective.success")} value={pct(i.successRate)} />
        <Metric
          label={t("collective.stuck")}
          hint={t("collective.stuckHint")}
          value={pct(i.stuckRate)}
          tone={i.stuckRate >= 0.25 ? "warning" : undefined}
        />
        <Metric
          label={t("collective.toSuccess")}
          value={
            i.avgAnswersToSuccess === null
              ? t("collective.none")
              : format.number(i.avgAnswersToSuccess, {
                  maximumFractionDigits: 1,
                })
          }
        />
        <Metric
          label={t("collective.tutorTime")}
          value={
            i.avgTutorSeconds === null
              ? t("collective.none")
              : t("collective.minutes", {
                  count: Math.max(1, Math.round(i.avgTutorSeconds / 60)),
                })
          }
        />
      </dl>
      <div className="grid gap-5 lg:grid-cols-3">
        {sectionList(
          t("collective.misconceptions"),
          t("collective.noMisconception"),
          i.misconceptions.map((m) => ({
            key: m.misconceptionId,
            body: m.description,
            side: (
              <Badge variant="warning" className="shrink-0 tabular-nums">
                {pct(m.share)}
              </Badge>
            ),
          })),
        )}
        {sectionList(
          t("collective.formats"),
          t("collective.noFormat"),
          i.formats.map((f) => ({
            key: `${f.format}-${String(f.scaffolded)}`,
            body: (
              <>
                {formatName(f)}
                <span className="block text-xs text-muted-foreground">
                  {t("collective.learners", { count: f.learners })}
                  {f.nextSuccessRate !== null &&
                    ` · ${t("collective.nextSuccess", { rate: pct(f.nextSuccessRate) })}`}
                </span>
              </>
            ),
            side: <GainBadge gain={f.gain} label={gain(f.gain)} />,
          })),
        )}
        {sectionList(
          t("collective.exercises"),
          t("collective.noExercise"),
          i.exercises.map((e) => ({
            key: e.intentId,
            body: (
              <>
                {e.objective}
                <span className="block text-xs text-muted-foreground">
                  {t("collective.learners", { count: e.learners })}
                </span>
              </>
            ),
            side: <GainBadge gain={e.gain} label={gain(e.gain)} />,
          })),
        )}
      </div>
    </Card>
  );

  const stuck = data.insights.filter((i) => i.stuckRate >= 0.25).length;

  return (
    <>
      <PageHeader
        title={t("collective.title")}
        description={t("collective.subtitle", { min: data.minLearners })}
        actions={data.insights.length > 0 ? <ComputeButton /> : undefined}
      />
      <section
        aria-label={t("collective.kpis")}
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 [&>*]:h-full"
      >
        <StatTile
          label={t("collective.notionsLabel")}
          value={data.insights.length}
          icon={<Lightbulb weight="fill" />}
          tone="mint"
        />
        <StatTile
          label={t("collective.stuckNotions")}
          value={stuck}
          hint={t("collective.stuckNotionsHint")}
          icon={<Warning weight="fill" />}
          tone="amber"
        />
        <StatTile
          label={t("collective.threshold")}
          value={data.minLearners}
          hint={t("collective.thresholdHint")}
          icon={<ShieldCheck weight="fill" />}
          tone="sky"
        />
        <StatTile
          label={t("collective.lastRun")}
          value={
            data.computedAt
              ? format.dateTime(new Date(data.computedAt), {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : t("collective.none")
          }
          hint={t("collective.nightly")}
          icon={<Clock weight="fill" />}
          tone="slate"
        />
      </section>
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
              className="rounded-full border bg-card px-3 py-1 outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-[current=page]:border-foreground aria-[current=page]:bg-foreground aria-[current=page]:text-background"
            >
              {c.name}
            </Link>
          ),
        )}
      </nav>
      {data.insights.length === 0 ? (
        <EmptyState
          icon={<ChartLineUp weight="fill" />}
          tone="mint"
          title={t("collective.empty", { min: data.minLearners })}
          titleAs="h2"
          description={t("collective.emptyHint")}
          action={<ComputeButton />}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {data.insights.map(notionCard)}
        </div>
      )}
    </>
  );
}
