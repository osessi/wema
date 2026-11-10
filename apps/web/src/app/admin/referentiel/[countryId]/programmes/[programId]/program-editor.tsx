"use client";

import {
  Archive,
  ArrowCounterClockwise,
  CaretDown,
  CheckCircle,
  Clock,
  PencilSimple,
  Plus,
  Stack,
} from "@phosphor-icons/react";
import { GlowTile } from "@wema/ui/brand";
import { ILLUSTRATION_FOR } from "@wema/ui/components/illustrations/illustration";
import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import { Card } from "@wema/ui/components/ui/card";
import { FieldSection } from "@wema/ui/components/ui/field";
import { Progress } from "@wema/ui/components/ui/progress";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import { cn } from "@wema/ui/lib/utils";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import type { NotionData, UnitData } from "../../../../../../lib/types";
import { useMutation } from "../../../../../../lib/use-mutation";
import {
  CheckboxField,
  Notice,
  TextAreaField,
  TextField,
} from "../../../../_ui/fields";
import { Code } from "../../../../_ui/kit";
import { NotionPanel } from "./notion-panel";

const nextPosition = (items: readonly { position: number }[]) =>
  items.reduce((max, item) => Math.max(max, item.position + 1), 0);

/** Sigle mono d'une unité : « Situation d'apprentissage » → « SA », « Chapitre » → « CH ». */
function unitAbbr(label: string): string {
  const words = label.split(/[\s'’-]+/).filter((w) => w.length > 2);
  if (words.length > 1)
    return words
      .map((w) => w[0])
      .join("")
      .slice(0, 3)
      .toUpperCase();
  return (words[0] ?? label).slice(0, 2).toUpperCase();
}

/** Badge d'état d'une notion : validée (succès) ou à valider (attention). */
export function VerifiedBadge({ verified }: { verified: boolean }) {
  const t = useTranslations("curriculum");
  return verified ? (
    <Badge variant="success" title={t("verified")}>
      <CheckCircle aria-hidden weight="fill" />
      {t("verifiedBadge")}
    </Badge>
  ) : (
    <Badge variant="warning">
      <Clock aria-hidden weight="fill" />
      {t("notVerified")}
    </Badge>
  );
}

export function ProgramEditor({
  programId,
  unitLabel,
  units,
  notions,
  canWrite,
  stats,
}: {
  programId: string;
  unitLabel: { singular: string; plural: string };
  units: readonly UnitData[];
  /** Toutes les notions du pays (pour les prérequis). */
  notions: readonly NotionData[];
  canWrite: boolean;
  /** Notions actives du programme : total et validées. */
  stats: { total: number; verified: number };
}) {
  const t = useTranslations();
  const { run, pending, error } = useMutation();
  const [showArchived, setShowArchived] = useState(false);
  const [unitFormOpen, setUnitFormOpen] = useState(false);
  const [openNotion, setOpenNotion] = useState<string | null>(null);
  const [newUnit, setNewUnit] = useState({ name: "", description: "" });

  const visibleUnits = [...units]
    .filter((u) => showArchived || !u.archived)
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));

  async function addUnit(e: FormEvent) {
    e.preventDefault();
    const result = await run("POST", "/admin/curriculum/units", {
      programId,
      name: newUnit.name,
      description: newUnit.description,
      position: nextPosition(units),
    });
    if (result.ok) {
      setNewUnit({ name: "", description: "" });
      setUnitFormOpen(false);
    }
  }
  const abbr = unitAbbr(unitLabel.singular);

  return (
    <div className="flex flex-col gap-4">
      <Card
        tone={
          stats.total > 0 && stats.verified === stats.total ? "mint" : "amber"
        }
        className="flex-row flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6"
      >
        <div className="flex min-w-[min(100%,16rem)] flex-1 flex-wrap items-center gap-x-3 gap-y-2">
          <Progress
            value={stats.total > 0 ? (stats.verified / stats.total) * 100 : 0}
            aria-label={t("curriculum.verifiedOf", {
              verified: stats.verified,
              total: stats.total,
            })}
            indicatorClassName="bg-success-text"
            className="basis-full sm:max-w-56 sm:basis-auto"
          />
          <span className="text-sm text-muted-foreground tabular-nums">
            {t("curriculum.verifiedOf", {
              verified: stats.verified,
              total: stats.total,
            })}
          </span>
          {stats.total - stats.verified > 0 ? (
            <Badge variant="warning" className="tabular-nums">
              {t("curriculum.pendingCount", {
                count: stats.total - stats.verified,
              })}
            </Badge>
          ) : null}
        </div>
        <CheckboxField
          label={t("common.showArchived")}
          checked={showArchived}
          onCheckedChange={setShowArchived}
        />
      </Card>
      {visibleUnits.length === 0 ? (
        <EmptyState
          illustration={ILLUSTRATION_FOR.emptyHomework}
          title={t("curriculum.noUnits", {
            label: unitLabel.singular.toLowerCase(),
          })}
          titleAs="h2"
        />
      ) : (
        visibleUnits.map((unit) => (
          <UnitBlock
            key={unit.id}
            unit={unit}
            abbr={abbr}
            units={units}
            unitLabel={unitLabel}
            notions={notions}
            showArchived={showArchived}
            openNotion={openNotion}
            onToggleNotion={(id) =>
              setOpenNotion(openNotion === id ? null : id)
            }
            canWrite={canWrite}
          />
        ))
      )}
      {error ? <Notice tone="error">{error}</Notice> : null}
      {canWrite ? (
        unitFormOpen ? (
          <form onSubmit={addUnit}>
            <FieldSection
              title={t("curriculum.newUnit", { label: unitLabel.singular })}
              tone="sky"
              icon={
                <GlowTile tone="sky" size={32}>
                  <Stack weight="fill" />
                </GlowTile>
              }
            >
              <TextField
                label={t("curriculum.unitName")}
                required
                value={newUnit.name}
                onChange={(e) =>
                  setNewUnit({ ...newUnit, name: e.target.value })
                }
              />
              <TextAreaField
                label={t("curriculum.unitDescription")}
                value={newUnit.description}
                onChange={(e) =>
                  setNewUnit({ ...newUnit, description: e.target.value })
                }
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setUnitFormOpen(false)}
                >
                  {t("common.cancel")}
                </Button>
                <Button type="submit" variant="brand" disabled={pending}>
                  {t("common.add")}
                </Button>
              </div>
            </FieldSection>
          </form>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full border-dashed"
            onClick={() => setUnitFormOpen(true)}
          >
            <Plus aria-hidden weight="bold" />
            {t("curriculum.newUnit", { label: unitLabel.singular })}
          </Button>
        )
      ) : null}
    </div>
  );
}

function UnitBlock({
  unit,
  abbr,
  units,
  unitLabel,
  notions,
  showArchived,
  openNotion,
  onToggleNotion,
  canWrite,
}: {
  unit: UnitData;
  abbr: string;
  units: readonly UnitData[];
  unitLabel: { singular: string; plural: string };
  notions: readonly NotionData[];
  showArchived: boolean;
  openNotion: string | null;
  onToggleNotion: (id: string) => void;
  canWrite: boolean;
}) {
  const t = useTranslations();
  const { run, pending, error } = useMutation();
  const [editing, setEditing] = useState<{
    name: string;
    description: string;
    position: number;
  } | null>(null);
  const [adding, setAdding] = useState(false);
  const [newNotion, setNewNotion] = useState({
    code: "",
    name: "",
    description: "",
  });

  const unitNotions = notions
    .filter((n) => n.unitId === unit.id && (showArchived || !n.archived))
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));

  async function saveUnit(changes: {
    name?: string;
    description?: string;
    position?: number;
    archived?: boolean;
  }) {
    const result = await run("PATCH", `/admin/curriculum/units/${unit.id}`, {
      name: changes.name ?? unit.name,
      description: changes.description ?? unit.description,
      position: changes.position ?? unit.position,
      archived: changes.archived ?? unit.archived,
    });
    if (result.ok) setEditing(null);
  }

  async function addNotion(e: FormEvent) {
    e.preventDefault();
    const result = await run("POST", "/admin/curriculum/notions", {
      unitId: unit.id,
      code: newNotion.code,
      name: newNotion.name,
      description: newNotion.description,
      position: nextPosition(notions.filter((n) => n.unitId === unit.id)),
    });
    if (result.ok) {
      setNewNotion({ code: "", name: "", description: "" });
      setAdding(false);
    }
  }

  const active = unitNotions.filter((n) => !n.archived);
  const verified = active.filter((n) => n.verified).length;
  const titleId = `unit-${unit.id}`;

  return (
    <Card className={cn("min-w-0 gap-0 py-0", unit.archived && "opacity-75")}>
      <section aria-labelledby={titleId} className="contents">
        <div className="p-4 sm:p-6">
          {editing ? (
            <div className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-[1fr_8rem] sm:items-start">
                <TextField
                  label={t("curriculum.unitName")}
                  required
                  value={editing.name}
                  onChange={(e) =>
                    setEditing({ ...editing, name: e.target.value })
                  }
                />
                <TextField
                  label={t("common.position")}
                  type="number"
                  min={0}
                  value={editing.position}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      position: Number(e.target.value),
                    })
                  }
                />
              </div>
              <TextAreaField
                label={t("curriculum.unitDescription")}
                value={editing.description}
                onChange={(e) =>
                  setEditing({ ...editing, description: e.target.value })
                }
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setEditing(null)}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={pending}
                  onClick={() => saveUnit(editing)}
                >
                  {t("common.save")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
              <div className="flex min-w-[min(100%,16rem)] flex-1 items-center gap-3">
                <span
                  className="grid h-10 min-w-12 shrink-0 place-items-center rounded-[10px] bg-info-soft px-2 font-mono text-[13px] font-medium tracking-[0.04em] text-foreground tabular-nums"
                  title={`${unitLabel.singular} ${unit.position + 1}`}
                >
                  {abbr} {String(unit.position + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 space-y-1">
                  <h2
                    id={titleId}
                    className="flex flex-wrap items-center gap-2 text-base font-semibold tracking-tight"
                  >
                    <span className="sr-only">
                      {unitLabel.singular} {unit.position + 1} :{" "}
                    </span>
                    {unit.name}
                    {unit.archived ? (
                      <Badge variant="neutral">{t("common.archived")}</Badge>
                    ) : null}
                  </h2>
                  {unit.description ? (
                    <p className="text-sm text-muted-foreground">
                      {unit.description}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {active.length > 0 ? (
                  <Badge
                    variant={verified === active.length ? "success" : "neutral"}
                    className="tabular-nums"
                  >
                    {t("curriculum.unitVerified", {
                      verified,
                      total: active.length,
                    })}
                  </Badge>
                ) : null}
                {canWrite ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setEditing({
                          name: unit.name,
                          description: unit.description,
                          position: unit.position,
                        })
                      }
                    >
                      <PencilSimple aria-hidden />
                      {t("common.edit")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => saveUnit({ archived: !unit.archived })}
                    >
                      {unit.archived ? (
                        <ArrowCounterClockwise aria-hidden />
                      ) : (
                        <Archive aria-hidden />
                      )}
                      {unit.archived
                        ? t("common.restore")
                        : t("common.archive")}
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          )}
        </div>

        {unitNotions.length === 0 ? (
          <div className="border-t px-4 sm:px-6">
            <EmptyState
              variant="inline"
              title={t("curriculum.noNotions")}
              titleAs="p"
            />
          </div>
        ) : (
          <ul className="divide-y border-t">
            {unitNotions.map((n) => {
              const open = openNotion === n.id;
              return (
                <li key={n.id} className={cn(open && "bg-muted/30")}>
                  <button
                    type="button"
                    onClick={() => onToggleNotion(n.id)}
                    aria-expanded={open}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset motion-reduce:transition-none sm:px-6"
                  >
                    <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
                      <Code className="text-muted-foreground">{n.code}</Code>
                      <span
                        className={cn(
                          "font-medium",
                          n.archived && "text-muted-foreground",
                        )}
                      >
                        {n.name}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {n.archived ? (
                        <Badge variant="neutral">{t("common.archived")}</Badge>
                      ) : null}
                      <VerifiedBadge verified={n.verified} />
                      <CaretDown
                        aria-hidden
                        className={cn(
                          "size-4 text-muted-foreground transition-transform motion-reduce:transition-none",
                          open && "rotate-180",
                        )}
                      />
                    </span>
                  </button>
                  {open ? (
                    <div className="px-2 pb-3 sm:px-6 sm:pb-4">
                      <NotionPanel
                        notion={n}
                        units={units}
                        notions={notions}
                        canWrite={canWrite}
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        {error ? (
          <div className="px-4 pb-4 sm:px-6">
            <Notice tone="error">{error}</Notice>
          </div>
        ) : null}
        {canWrite && !unit.archived ? (
          <div className="border-t bg-muted/30 px-4 py-3 sm:px-6">
            {adding ? (
              <form className="flex flex-col gap-4 py-1" onSubmit={addNotion}>
                <div className="grid gap-4 sm:grid-cols-[minmax(0,14rem)_1fr] sm:items-start">
                  <TextField
                    label={t("curriculum.notionCode")}
                    hint={t("curriculum.notionCodeHint")}
                    required
                    pattern="[a-z0-9][a-z0-9\-]{0,63}"
                    value={newNotion.code}
                    onChange={(e) =>
                      setNewNotion({ ...newNotion, code: e.target.value })
                    }
                  />
                  <TextField
                    label={t("curriculum.notionName")}
                    required
                    value={newNotion.name}
                    onChange={(e) =>
                      setNewNotion({ ...newNotion, name: e.target.value })
                    }
                  />
                </div>
                <TextAreaField
                  label={t("curriculum.notionDescription")}
                  required
                  value={newNotion.description}
                  onChange={(e) =>
                    setNewNotion({ ...newNotion, description: e.target.value })
                  }
                />
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setAdding(false)}
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button type="submit" size="sm" disabled={pending}>
                    {t("common.create")}
                  </Button>
                </div>
              </form>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setAdding(true)}
              >
                <Plus aria-hidden weight="bold" />
                {t("curriculum.newNotion")}
              </Button>
            )}
          </div>
        ) : null}
      </section>
    </Card>
  );
}
