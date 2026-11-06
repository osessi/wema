"use client";

import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import type { NotionData, UnitData } from "../../../../../../lib/types";
import { useMutation } from "../../../../../../lib/use-mutation";
import {
  CheckboxField,
  EmptyState,
  Notice,
  TextAreaField,
  TextField,
} from "../../../../_ui/fields";
import { NotionPanel } from "./notion-panel";

const nextPosition = (items: readonly { position: number }[]) =>
  items.reduce((max, item) => Math.max(max, item.position + 1), 0);

export function ProgramEditor({
  programId,
  unitLabel,
  units,
  notions,
  canWrite,
}: {
  programId: string;
  unitLabel: { singular: string; plural: string };
  units: readonly UnitData[];
  /** Toutes les notions du pays (pour les prérequis). */
  notions: readonly NotionData[];
  canWrite: boolean;
}) {
  const t = useTranslations();
  const { run, pending, error } = useMutation();
  const [showArchived, setShowArchived] = useState(false);
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
    if (result.ok) setNewUnit({ name: "", description: "" });
  }

  return (
    <div className="flex flex-col gap-6">
      <CheckboxField
        label={t("common.showArchived")}
        checked={showArchived}
        onCheckedChange={setShowArchived}
      />
      {visibleUnits.length === 0 ? (
        <EmptyState>
          {t("curriculum.noUnits", { label: unitLabel.singular.toLowerCase() })}
        </EmptyState>
      ) : (
        visibleUnits.map((unit) => (
          <UnitBlock
            key={unit.id}
            unit={unit}
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
        <form className="flex flex-col gap-4" onSubmit={addUnit}>
          <h3 className="font-display text-lg font-semibold">
            {t("curriculum.newUnit", { label: unitLabel.singular })}
          </h3>
          <TextField
            label={t("curriculum.unitName")}
            required
            value={newUnit.name}
            onChange={(e) => setNewUnit({ ...newUnit, name: e.target.value })}
          />
          <TextAreaField
            label={t("curriculum.unitDescription")}
            value={newUnit.description}
            onChange={(e) =>
              setNewUnit({ ...newUnit, description: e.target.value })
            }
          />
          <div>
            <Button type="submit" disabled={pending}>
              {t("common.add")}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function UnitBlock({
  unit,
  units,
  unitLabel,
  notions,
  showArchived,
  openNotion,
  onToggleNotion,
  canWrite,
}: {
  unit: UnitData;
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

  return (
    <section className="flex flex-col gap-4 border-t pt-4">
      {editing ? (
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label={t("curriculum.unitName")}
              required
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            />
            <TextField
              label={t("common.position")}
              type="number"
              min={0}
              value={editing.position}
              onChange={(e) =>
                setEditing({ ...editing, position: Number(e.target.value) })
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
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={() => saveUnit(editing)}
            >
              {t("common.save")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setEditing(null)}
            >
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="text-sm text-muted-foreground">
              {unitLabel.singular} {unit.position + 1}
            </div>
            <h3 className="font-display text-lg font-semibold">
              {unit.name}{" "}
              {unit.archived ? (
                <Badge variant="outline">{t("common.archived")}</Badge>
              ) : null}
            </h3>
            {unit.description ? (
              <p className="text-muted-foreground">{unit.description}</p>
            ) : null}
          </div>
          {canWrite ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setEditing({
                    name: unit.name,
                    description: unit.description,
                    position: unit.position,
                  })
                }
              >
                {t("common.edit")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => saveUnit({ archived: !unit.archived })}
              >
                {unit.archived ? t("common.restore") : t("common.archive")}
              </Button>
            </div>
          ) : null}
        </div>
      )}

      {unitNotions.length === 0 ? (
        <EmptyState>{t("curriculum.noNotions")}</EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {unitNotions.map((n) => (
            <li key={n.id} className="rounded-lg border">
              <button
                type="button"
                onClick={() => onToggleNotion(n.id)}
                aria-expanded={openNotion === n.id}
                className="flex w-full flex-wrap items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/50"
              >
                <code className="text-sm text-muted-foreground">{n.code}</code>
                <span className="flex-1 font-medium">{n.name}</span>
                <Badge variant={n.verified ? "default" : "outline"}>
                  {n.verified
                    ? t("curriculum.verified")
                    : t("curriculum.notVerified")}
                </Badge>
                {n.archived ? (
                  <Badge variant="outline">{t("common.archived")}</Badge>
                ) : null}
              </button>
              {openNotion === n.id ? (
                <div className="px-3 pb-3">
                  <NotionPanel
                    notion={n}
                    units={units}
                    notions={notions}
                    canWrite={canWrite}
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {error ? <Notice tone="error">{error}</Notice> : null}
      {canWrite && !unit.archived ? (
        adding ? (
          <form className="flex flex-col gap-4" onSubmit={addNotion}>
            <div className="grid gap-4 sm:grid-cols-2">
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
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" size="sm" disabled={pending}>
                {t("common.create")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setAdding(false)}
              >
                {t("common.cancel")}
              </Button>
            </div>
          </form>
        ) : (
          <div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setAdding(true)}
            >
              {t("curriculum.newNotion")}
            </Button>
          </div>
        )
      ) : null}
    </section>
  );
}
