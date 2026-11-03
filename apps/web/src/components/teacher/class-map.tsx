"use client";

import { Lightbulb } from "@phosphor-icons/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@wema/ui/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@wema/ui/components/ui/table";
import { cn } from "@wema/ui/lib/utils";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  type ClassMap,
  NOTION_STATUSES,
  type NotionStatus,
} from "../../lib/teacher-types";
import { STATUS_CLASSES, StatusBadge, StatusLegend } from "./status";

const NODE_W = 210;
const NODE_H = 76;
const COL_GAP = 70;
const ROW_GAP = 28;

/** Profondeur de chaque notion : plus long chemin de prérequis qui y mène. */
function layers(ids: string[], edges: { from: string; to: string }[]) {
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

function Constellation({
  map,
  edges,
  selected,
  onSelect,
}: {
  map: ClassMap;
  edges: { from: string; to: string }[];
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

  return (
    <div className="overflow-x-auto rounded-xl border bg-card p-4">
      <div className="relative" style={{ width, height }}>
        <svg
          className="absolute inset-0 text-border"
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
            return (
              <path
                key={`${e.from}-${e.to}`}
                d={`M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              />
            );
          })}
        </svg>
        {map.notions.map((n) => {
          const p = pos.get(n.notionId);
          if (!p) return null;
          return (
            <button
              key={n.notionId}
              type="button"
              onClick={() => onSelect(n.notionId)}
              aria-pressed={selected === n.notionId}
              className={cn(
                "absolute flex flex-col justify-between rounded-lg border bg-background p-2.5 text-left text-sm transition-colors hover:border-foreground/40 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                selected === n.notionId && "border-foreground",
              )}
              style={{ left: p.x, top: p.y, width: NODE_W, height: NODE_H }}
            >
              <span className="line-clamp-2 font-medium leading-tight">
                {n.name}
              </span>
              <span className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
                {total > 0 &&
                  (["mastered", "in_progress", "needs_work"] as const).map(
                    (s) =>
                      n.counts[s] > 0 ? (
                        <span
                          key={s}
                          className={STATUS_CLASSES[s]}
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
  const notion = map.notions.find((n) => n.notionId === notionId);
  if (!notion) return null;
  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="font-display text-lg">{notion.name}</CardTitle>
        <CardDescription>{t("detailHint")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          {NOTION_STATUSES.map((s) => {
            const who = map.learners.filter((l) => l.statuses[notionId] === s);
            return (
              <div key={s} className="space-y-1">
                <div className="flex items-center gap-2">
                  <StatusBadge status={s} />
                  <span className="text-sm text-muted-foreground">
                    {who.length}
                  </span>
                </div>
                {who.length > 0 && (
                  <p className="text-sm">
                    {who.map((l, i) => (
                      <span key={l.userId}>
                        {i > 0 && ", "}
                        <Link
                          className="hover:underline"
                          href={`/prof/eleves/${orgId}/${l.userId}`}
                        >
                          {l.displayName}
                        </Link>
                      </span>
                    ))}
                  </p>
                )}
              </div>
            );
          })}
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">{t("misconceptions")}</h3>
          {notion.topMisconceptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("noMisconceptionNotion")}
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {notion.topMisconceptions.map((m) => (
                <li key={m.misconceptionId} className="rounded-lg border p-2">
                  {m.description ?? t("unnamedMisconception")}
                  <span className="block text-xs text-muted-foreground">
                    {t("learnersConcerned", { count: m.learners })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Grid({ map, orgId }: { map: ClassMap; orgId: string }) {
  const t = useTranslations("teacher.map");
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("learner")}</TableHead>
          {map.notions.map((n) => (
            <TableHead key={n.notionId} className="min-w-32 whitespace-normal">
              {n.name}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {map.learners.map((l) => (
          <TableRow key={l.userId}>
            <TableCell className="font-medium">
              <Link
                className="hover:underline"
                href={`/prof/eleves/${orgId}/${l.userId}`}
              >
                {l.displayName}
              </Link>
            </TableCell>
            {map.notions.map((n) => {
              const s: NotionStatus = l.statuses[n.notionId] ?? "not_seen";
              return (
                <TableCell key={n.notionId}>
                  <StatusBadge status={s} />
                </TableCell>
              );
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** Carte de la classe : constellation des notions, grille élèves × notions, idées fausses. */
export function ClassMapView({
  map,
  edges,
  orgId,
}: {
  map: ClassMap;
  edges: { from: string; to: string }[];
  orgId: string;
}) {
  const t = useTranslations("teacher.map");
  const [selected, setSelected] = useState<string | null>(
    map.notions[0]?.notionId ?? null,
  );
  const frequent = map.notions
    .flatMap((n) => n.topMisconceptions.map((m) => ({ ...m, notion: n.name })))
    .sort((a, b) => b.learners - a.learners)
    .slice(0, 6);

  if (map.notions.length === 0)
    return <p className="text-muted-foreground">{t("noProgram")}</p>;

  return (
    <>
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-xl font-bold">
              {t("constellation")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {edges.length > 0 ? t("constellationHint") : t("noPrerequisites")}
            </p>
          </div>
          <StatusLegend />
        </div>
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

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-display text-xl font-bold">
          <Lightbulb className="size-5" />
          {t("collective")}
        </h2>
        {frequent.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("noMisconception")}
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {frequent.map((m) => (
              <li
                key={m.misconceptionId}
                className="rounded-xl border bg-card p-3 text-sm"
              >
                <span className="block text-xs text-muted-foreground">
                  {m.notion}
                </span>
                <span className="font-medium">
                  {m.description ?? t("unnamedMisconception")}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {t("learnersConcerned", { count: m.learners })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold">{t("grid")}</h2>
        <div className="rounded-xl border bg-card">
          <Grid map={map} orgId={orgId} />
        </div>
      </section>
    </>
  );
}
