"use client";

import {
  ChartLineUp,
  Graph,
  Lightbulb,
  TreeStructure,
} from "@phosphor-icons/react";
import { GlowTile } from "@wema/ui/brand";
import { ILLUSTRATION_FOR } from "@wema/ui/components/illustrations/illustration";
import { Badge } from "@wema/ui/components/ui/badge";
import { CARD_INNER_SHADOW, CardShell } from "@wema/ui/components/ui/card";
import { Skeleton } from "@wema/ui/components/ui/skeleton";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import { NotionHeatmap } from "@wema/ui/components/wema/notion-heatmap";
import {
  NOTION_STATUS_TONES,
  NotionStatus,
  NotionStatusLegend,
} from "@wema/ui/components/wema/notion-status";
import { PersonAvatar } from "@wema/ui/components/wema/person-avatar";
import { cn } from "@wema/ui/lib/utils";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { browserApi } from "../../lib/insights-client";
import type { NotionInsights } from "../../lib/insights-types";
import { type ClassMap, NOTION_STATUSES } from "../../lib/teacher-types";
import { SectionHeading } from "./section";

const NODE_W = 216;
const NODE_H = 84;
const COL_GAP = 72;
const ROW_GAP = 24;

type Edge = { from: string; to: string };

/** Profondeur de chaque notion : plus long chemin de prérequis qui y mène. */
function layers(ids: string[], edges: Edge[]) {
  const depth = new Map<string, number>();
  const visit = (id: string, seen: Set<string>): number => {
    const known = depth.get(id);
    if (known !== undefined) return known;
    if (seen.has(id)) return 0;
    seen.add(id);
    const parents = edges.filter((e) => e.to === id).map((e) => e.from);
    const d =
      parents.length === 0
        ? 0
        : Math.max(...parents.map((p) => visit(p, seen))) + 1;
    depth.set(id, d);
    return d;
  };
  for (const id of ids) visit(id, new Set());
  return depth;
}

/** Notions qui mènent (directement ou non) à `id`, et `id` lui-même. */
function pathTo(id: string | null, edges: Edge[]) {
  const path = new Set<string>();
  if (!id) return path;
  const stack = [id];
  while (stack.length > 0) {
    const cur = stack.pop();
    if (cur === undefined || path.has(cur)) continue;
    path.add(cur);
    for (const e of edges) if (e.to === cur) stack.push(e.from);
  }
  return path;
}

const BAR_ORDER = ["mastered", "in_progress", "needs_work"] as const;
/** Couleur de chaque segment de la barre d'un nœud. */
const BAR_TONE: Record<(typeof BAR_ORDER)[number], string> = {
  mastered: NOTION_STATUS_TONES.mastered.dot,
  in_progress: "bg-brand",
  needs_work: NOTION_STATUS_TONES.needs_work.dot,
};

function Constellation({
  map,
  edges,
  selected,
  onSelect,
}: {
  map: ClassMap;
  edges: Edge[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const t = useTranslations("teacher.map");
  const depth = layers(
    map.notions.map((n) => n.notionId),
    edges,
  );
  const columns = new Map<number, string[]>();
  for (const n of map.notions) {
    const d = depth.get(n.notionId) ?? 0;
    columns.set(d, [...(columns.get(d) ?? []), n.notionId]);
  }
  const pos = new Map<string, { x: number; y: number }>();
  for (const [d, ids] of columns)
    ids.forEach((id, i) => {
      pos.set(id, {
        x: d * (NODE_W + COL_GAP),
        y: i * (NODE_H + ROW_GAP),
      });
    });
  const width =
    Math.max(...[...columns.keys()].map((d) => d + 1)) * (NODE_W + COL_GAP) -
    COL_GAP;
  const height =
    Math.max(...[...columns.values()].map((c) => c.length)) *
      (NODE_H + ROW_GAP) -
    ROW_GAP;
  const total = map.learners.length;
  const lit = pathTo(selected, edges);

  return (
    <CardShell tone="sky">
      <div
        className={cn(
          "max-w-full overflow-x-auto overscroll-x-contain rounded-card border bg-card bg-[radial-gradient(circle,var(--border)_1px,transparent_1px)] [background-size:16px_16px] p-5",
          CARD_INNER_SHADOW,
        )}
      >
        <div className="relative" style={{ width, height }}>
          <svg
            className="absolute inset-0"
            width={width}
            height={height}
            aria-hidden="true"
          >
            {edges.map((e) => {
              const a = pos.get(e.from);
              const b = pos.get(e.to);
              if (!a || !b) return null;
              const x1 = a.x + NODE_W;
              const y1 = a.y + NODE_H / 2;
              const x2 = b.x;
              const y2 = b.y + NODE_H / 2;
              const mid = (x1 + x2) / 2;
              const on = lit.has(e.from) && lit.has(e.to);
              return (
                <path
                  key={`${e.from}-${e.to}`}
                  d={`M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`}
                  fill="none"
                  className={cn(
                    "transition-[stroke] duration-200 motion-reduce:transition-none",
                    on ? "stroke-brand" : "stroke-border",
                  )}
                  strokeWidth={on ? 2.5 : 1.5}
                />
              );
            })}
          </svg>
          {map.notions.map((n) => {
            const p = pos.get(n.notionId);
            if (!p) return null;
            const active = selected === n.notionId;
            return (
              <button
                key={n.notionId}
                type="button"
                onClick={() => onSelect(n.notionId)}
                aria-pressed={active}
                className={cn(
                  "absolute flex flex-col justify-between gap-2 rounded-[14px] border bg-background p-3 text-left text-sm shadow-xs transition-[border-color,box-shadow] hover:border-foreground/30 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none",
                  active && "border-brand ring-2 ring-brand/40",
                  !active && lit.has(n.notionId) && "border-brand/60",
                )}
                style={{ left: p.x, top: p.y, width: NODE_W, height: NODE_H }}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="line-clamp-2 leading-tight font-medium">
                    {n.name}
                  </span>
                  <span
                    aria-hidden
                    className="shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums"
                  >
                    {t("masteredShort", { mastered: n.counts.mastered, total })}
                  </span>
                </span>
                <span
                  aria-hidden
                  className="flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full bg-muted"
                >
                  {total > 0 &&
                    BAR_ORDER.map((s) =>
                      n.counts[s] > 0 ? (
                        <span
                          key={s}
                          className={cn("h-full rounded-full", BAR_TONE[s])}
                          style={{ width: `${(n.counts[s] / total) * 100}%` }}
                        />
                      ) : null,
                    )}
                </span>
                <span className="sr-only">
                  {t("nodeSummary", {
                    mastered: n.counts.mastered,
                    total,
                  })}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </CardShell>
  );
}

function NotionDetail({
  map,
  notionId,
  orgId,
}: {
  map: ClassMap;
  notionId: string;
  orgId: string;
}) {
  const t = useTranslations("teacher.map");
  const ts = useTranslations("teacher.status");
  const notion = map.notions.find((n) => n.notionId === notionId);
  if (!notion) return null;
  return (
    <CardShell>
      <div
        className={cn(
          "grid gap-4 rounded-card border bg-card p-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]",
          CARD_INNER_SHADOW,
        )}
      >
        <div className="min-w-0 space-y-4">
          <div className="space-y-1">
            <h3 className="text-base font-semibold tracking-tight">
              {notion.name}
            </h3>
            <p className="text-sm text-muted-foreground">{t("detailHint")}</p>
          </div>
          <ul className="divide-y rounded-control border">
            {[...NOTION_STATUSES].reverse().map((s) => {
              const who = map.learners.filter(
                (l) => l.statuses[notionId] === s,
              );
              return (
                <li
                  key={s}
                  className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center"
                >
                  <div className="flex w-36 shrink-0 items-center gap-2">
                    <NotionStatus status={s} label={ts(s)} size="sm" />
                    <span className="font-mono text-xs text-muted-foreground tabular-nums">
                      {who.length}
                    </span>
                  </div>
                  {who.length > 0 ? (
                    <ul className="flex min-w-0 flex-wrap gap-1.5">
                      {who.map((l) => (
                        <li key={l.userId}>
                          <Link
                            href={`/prof/eleves/${orgId}/${l.userId}`}
                            className="inline-flex items-center gap-1.5 rounded-full border bg-background py-0.5 pr-2.5 pl-0.5 text-xs font-medium outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <PersonAvatar
                              name={l.displayName}
                              seed={l.userId}
                              size="xs"
                              decorative
                            />
                            {l.displayName}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {t("noLearner")}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
        <div className="min-w-0 space-y-3">
          <h4 className="flex items-center gap-2 text-sm font-semibold">
            <GlowTile tone="amber" size={24} glyph="64%">
              <Lightbulb weight="fill" />
            </GlowTile>
            {t("misconceptions")}
          </h4>
          {notion.topMisconceptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("noMisconceptionNotion")}
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {notion.topMisconceptions.map((m) => (
                <li
                  key={m.misconceptionId}
                  className="flex flex-col items-start gap-1.5 rounded-control border bg-warning-soft/40 p-3"
                >
                  <span>{m.description ?? t("unnamedMisconception")}</span>
                  <Badge variant="warning">
                    {t("learnersConcerned", { count: m.learners })}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </CardShell>
  );
}

const FORMATS = new Set(["text", "easy_reading", "diagram", "comics", "audio"]);

/**
 * « Ce qui marche ailleurs » : agrégats anonymisés sur l'ensemble des élèves
 * Wema pour les notions de la classe (seulement des groupes d'au moins 10).
 */
function Elsewhere({ notions }: { notions: ClassMap["notions"] }) {
  const t = useTranslations("insights");
  const format = useFormatter();
  const [data, setData] = useState<NotionInsights | null>(null);
  const ids = notions.map((n) => n.notionId).join(",");
  useEffect(() => {
    let live = true;
    browserApi()
      .admin.collective.notions.$get({ query: { ids } })
      .then(async (res) => {
        const body = res.status === 200 ? await res.json() : null;
        if (live && body && "insights" in body) setData(body);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [ids]);
  const pct = (x: number) => format.number(x, { style: "percent" });
  const name = new Map<string, string>(
    notions.map((n) => [n.notionId, n.name]),
  );
  return (
    <section className="space-y-4" aria-labelledby="elsewhere-title">
      <SectionHeading
        id="elsewhere-title"
        title={t("elsewhere.title")}
        description={t("elsewhere.hint")}
      />
      {data === null ? (
        <div
          className="grid gap-3 sm:grid-cols-2"
          role="status"
          aria-label={t("elsewhere.loading")}
        >
          <Skeleton className="h-24 rounded-card" />
          <Skeleton className="h-24 rounded-card" />
        </div>
      ) : data.insights.length === 0 ? (
        <EmptyState
          variant="inline"
          icon={<ChartLineUp weight="fill" />}
          tone="sky"
          titleAs="p"
          title={t("elsewhere.unavailable", { min: data.minLearners })}
          className="rounded-card border border-dashed"
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {data.insights.map((i) => {
            const best = i.formats.find((f) => (f.gain ?? 0) > 0);
            const m = i.misconceptions[0];
            const e = i.exercises.find((x) => (x.gain ?? 0) > 0);
            return (
              <li key={i.notionId} className="min-w-0">
                <CardShell tone="sky" className="h-full">
                  <div
                    className={cn(
                      "flex flex-1 flex-col gap-2 rounded-card border bg-card p-4 text-sm",
                      CARD_INNER_SHADOW,
                    )}
                  >
                    <span className="font-medium">{name.get(i.notionId)}</span>
                    <span className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
                      {t("elsewhere.learners", {
                        count: i.learners,
                        rate: pct(i.successRate),
                        stuck: pct(i.stuckRate),
                      })}
                    </span>
                    {best && (
                      <p>
                        {t("elsewhere.bestFormat", {
                          format: `${FORMATS.has(best.format) ? t(`formats.${best.format}`) : best.format}${best.scaffolded === null ? "" : `, ${t(best.scaffolded ? "formats.guided" : "formats.plain")}`}`,
                        })}
                      </p>
                    )}
                    {m && (
                      <p className="text-muted-foreground">
                        {t("elsewhere.misconception", {
                          description: m.description,
                          share: pct(m.share),
                        })}
                      </p>
                    )}
                    {e && (
                      <p className="text-muted-foreground">
                        {t("elsewhere.exercise", { objective: e.objective })}
                      </p>
                    )}
                  </div>
                </CardShell>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Carte de la classe : constellation des notions, grille élèves × notions, idées fausses. */
export function ClassMapView({
  map,
  edges,
  orgId,
}: {
  map: ClassMap;
  edges: Edge[];
  orgId: string;
}) {
  const t = useTranslations("teacher.map");
  const ts = useTranslations("teacher.status");
  const [selected, setSelected] = useState<string | null>(
    map.notions[0]?.notionId ?? null,
  );
  const frequent = map.notions
    .flatMap((n) => n.topMisconceptions.map((m) => ({ ...m, notion: n.name })))
    .sort((a, b) => b.learners - a.learners)
    .slice(0, 6);
  const byHref = new Map(
    map.learners.map((l) => [`/prof/eleves/${orgId}/${l.userId}`, l]),
  );
  const statusLabels = {
    not_seen: ts("not_seen"),
    needs_work: ts("needs_work"),
    in_progress: ts("in_progress"),
    mastered: ts("mastered"),
  };

  if (map.notions.length === 0)
    return (
      <EmptyState
        icon={<TreeStructure weight="fill" />}
        tone="sky"
        title={t("constellation")}
        description={t("noProgram")}
      />
    );

  return (
    <>
      <section className="space-y-4" aria-labelledby="constellation-title">
        <SectionHeading
          id="constellation-title"
          eyebrow={t("constellationEyebrow")}
          title={t("constellation")}
          description={
            edges.length > 0 ? t("constellationHint") : t("noPrerequisites")
          }
          actions={<NotionStatusLegend labels={statusLabels} />}
        />
        {edges.length > 0 && (
          <Constellation
            map={map}
            edges={edges}
            selected={selected}
            onSelect={setSelected}
          />
        )}
        {edges.length > 0 && selected && (
          <NotionDetail map={map} notionId={selected} orgId={orgId} />
        )}
      </section>

      <section className="space-y-4" aria-labelledby="grid-title">
        <SectionHeading
          id="grid-title"
          eyebrow={t("gridEyebrow")}
          title={t("grid")}
        />
        {map.learners.length === 0 ? (
          <EmptyState
            illustration={ILLUSTRATION_FOR.emptyClasses}
            titleAs="p"
            title={t("noLearner")}
          />
        ) : (
          <div className="space-y-3">
            <CardShell tone="sky" className="w-fit max-w-full">
              <NotionHeatmap
                className="max-w-full"
                legend={false}
                caption={t("gridCaption")}
                learnerHeader={t("learner")}
                statusLabels={statusLabels}
                notions={map.notions.map((n) => ({
                  id: n.notionId,
                  name: n.name,
                }))}
                learners={map.learners.map((l) => ({
                  id: l.userId,
                  name: l.displayName,
                  href: `/prof/eleves/${orgId}/${l.userId}`,
                  statuses: l.statuses,
                }))}
                renderLink={({ href, className, children }) => {
                  const learner = byHref.get(href);
                  return (
                    <Link
                      href={href}
                      className={cn(
                        className,
                        "inline-flex items-center gap-2",
                      )}
                    >
                      {learner ? (
                        <PersonAvatar
                          name={learner.displayName}
                          seed={learner.userId}
                          size="sm"
                          decorative
                        />
                      ) : null}
                      {children}
                    </Link>
                  );
                }}
              />
            </CardShell>
            <NotionStatusLegend labels={statusLabels} />
          </div>
        )}
      </section>

      <section className="space-y-4" aria-labelledby="collective-title">
        <SectionHeading
          id="collective-title"
          eyebrow={t("collectiveEyebrow")}
          title={t("collective")}
        />
        {frequent.length === 0 ? (
          <EmptyState
            variant="inline"
            icon={<Graph weight="fill" />}
            tone="mint"
            titleAs="p"
            title={t("noMisconception")}
            className="rounded-card border border-dashed"
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {frequent.map((m) => (
              <li key={m.misconceptionId} className="min-w-0">
                <CardShell tone="amber" className="h-full">
                  <div
                    className={cn(
                      "flex flex-1 flex-col items-start gap-3 rounded-card border bg-card p-4 text-sm",
                      CARD_INNER_SHADOW,
                    )}
                  >
                    <Badge variant="info" className="max-w-full truncate">
                      {m.notion}
                    </Badge>
                    <span className="flex-1 font-medium">
                      {m.description ?? t("unnamedMisconception")}
                    </span>
                    <Badge variant="warning">
                      {t("learnersConcerned", { count: m.learners })}
                    </Badge>
                  </div>
                </CardShell>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Elsewhere notions={map.notions} />
    </>
  );
}
