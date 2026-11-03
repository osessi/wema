"use client";

import {
  Alert,
  Badge,
  Button,
  Checkbox,
  EmptyState,
  TextAreaField,
  TextField,
} from "@wema/ui";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import type { NotionData, UnitData } from "../../../../../../lib/types";
import { useMutation } from "../../../../../../lib/use-mutation";
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
    <div className="w-stack" style={{ gap: 20 }}>
      <Checkbox
        label={t("common.showArchived")}
        checked={showArchived}
        onChange={(e) => setShowArchived(e.target.checked)}
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
      {error ? <Alert tone="error">{error}</Alert> : null}
      {canWrite ? (
        <form className="w-stack" onSubmit={addUnit}>
          <h3 className="w-card__title">
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
    <section
      className="w-stack"
      style={{ borderTop: "1px solid var(--w-border-soft)", paddingTop: 16 }}
    >
      {editing ? (
        <div className="w-stack">
          <div className="w-grid w-grid--narrow">
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
          <div className="w-row">
            <Button
              size="sm"
              disabled={pending}
              onClick={() => saveUnit(editing)}
            >
              {t("common.save")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <div
          className="w-row"
          style={{ justifyContent: "space-between", alignItems: "flex-start" }}
        >
          <div>
            <div className="w-muted w-small">
              {unitLabel.singular} {unit.position + 1}
            </div>
            <h3 className="w-card__title">
              {unit.name}{" "}
              {unit.archived ? (
                <Badge tone="grey">{t("common.archived")}</Badge>
              ) : null}
            </h3>
            {unit.description ? (
              <p className="w-muted" style={{ margin: 0 }}>
                {unit.description}
              </p>
            ) : null}
          </div>
          {canWrite ? (
            <div className="w-row">
              <Button
                size="sm"
                variant="secondary"
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
        <ul
          className="w-stack"
          style={{ listStyle: "none", margin: 0, padding: 0, gap: 8 }}
        >
          {unitNotions.map((n) => (
            <li
              key={n.id}
              style={{
                border: "1px solid var(--w-border-soft)",
                borderRadius: "var(--w-radius)",
              }}
            >
              <button
                type="button"
                onClick={() => onToggleNotion(n.id)}
                aria-expanded={openNotion === n.id}
                className="w-row"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <code className="w-muted w-small">{n.code}</code>
                <span className="w-grow" style={{ fontWeight: 500 }}>
                  {n.name}
                </span>
                <Badge tone={n.verified ? "green" : "orange"}>
                  {n.verified
                    ? t("curriculum.verified")
                    : t("curriculum.notVerified")}
                </Badge>
                {n.archived ? (
                  <Badge tone="grey">{t("common.archived")}</Badge>
                ) : null}
              </button>
              {openNotion === n.id ? (
                <div style={{ padding: "0 12px 12px" }}>
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

      {error ? <Alert tone="error">{error}</Alert> : null}
      {canWrite && !unit.archived ? (
        adding ? (
          <form className="w-stack" onSubmit={addNotion}>
            <div className="w-grid w-grid--narrow">
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
            <div className="w-row">
              <Button type="submit" size="sm" disabled={pending}>
                {t("common.create")}
              </Button>
              <Button
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
              size="sm"
              variant="secondary"
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
