"use client";

import {
  Alert,
  Badge,
  Button,
  Checkbox,
  EmptyState,
  SelectField,
  TextAreaField,
  TextField,
} from "@wema/ui";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import type { NotionData, UnitData } from "../../../../../../lib/types";
import { useMutation } from "../../../../../../lib/use-mutation";

/** Fiche d'une notion : champs, prérequis et idées fausses. */
export function NotionPanel({
  notion,
  units,
  notions,
  canWrite,
}: {
  notion: NotionData;
  units: readonly UnitData[];
  notions: readonly NotionData[];
  canWrite: boolean;
}) {
  const t = useTranslations();
  return (
    <div className="w-stack" style={{ gap: 20 }}>
      <h4 className="w-card__title" style={{ fontSize: 14 }}>
        {t("curriculum.editNotion")}
      </h4>
      <NotionFields notion={notion} units={units} canWrite={canWrite} />
      <Prerequisites notion={notion} notions={notions} canWrite={canWrite} />
      <Misconceptions notion={notion} canWrite={canWrite} />
    </div>
  );
}

function NotionFields({
  notion,
  units,
  canWrite,
}: {
  notion: NotionData;
  units: readonly UnitData[];
  canWrite: boolean;
}) {
  const t = useTranslations();
  const { run, pending, error } = useMutation();
  const [saved, setSaved] = useState(false);
  const [values, setValues] = useState<{
    unitId: string;
    code: string;
    name: string;
    description: string;
    position: number;
    verified: boolean;
    archived: boolean;
  }>({
    unitId: notion.unitId,
    code: notion.code,
    name: notion.name,
    description: notion.description,
    position: notion.position,
    verified: notion.verified,
    archived: notion.archived,
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaved(false);
    setSaved(
      (await run("PATCH", `/admin/curriculum/notions/${notion.id}`, values)).ok,
    );
  }

  return (
    <form className="w-stack" onSubmit={submit}>
      <div className="w-grid w-grid--narrow">
        <TextField
          label={t("curriculum.notionCode")}
          hint={t("curriculum.notionCodeHint")}
          required
          disabled={!canWrite}
          value={values.code}
          onChange={(e) => setValues({ ...values, code: e.target.value })}
        />
        <TextField
          label={t("curriculum.notionName")}
          required
          disabled={!canWrite}
          value={values.name}
          onChange={(e) => setValues({ ...values, name: e.target.value })}
        />
        <SelectField
          label={t("curriculum.unit")}
          disabled={!canWrite}
          value={values.unitId}
          onChange={(e) => setValues({ ...values, unitId: e.target.value })}
        >
          {units
            .filter((u) => !u.archived || u.id === notion.unitId)
            .map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
        </SelectField>
        <TextField
          label={t("common.position")}
          type="number"
          min={0}
          disabled={!canWrite}
          value={values.position}
          onChange={(e) =>
            setValues({ ...values, position: Number(e.target.value) })
          }
        />
      </div>
      <TextAreaField
        label={t("curriculum.notionDescription")}
        required
        disabled={!canWrite}
        value={values.description}
        onChange={(e) => setValues({ ...values, description: e.target.value })}
      />
      <div className="w-row" style={{ gap: 20 }}>
        <Checkbox
          label={t("curriculum.verified")}
          disabled={!canWrite}
          checked={values.verified}
          onChange={(e) => setValues({ ...values, verified: e.target.checked })}
        />
        <Checkbox
          label={t("common.archived")}
          disabled={!canWrite}
          checked={values.archived}
          onChange={(e) => setValues({ ...values, archived: e.target.checked })}
        />
      </div>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {saved ? <Alert tone="success">{t("common.saved")}</Alert> : null}
      {canWrite ? (
        <div>
          <Button type="submit" size="sm" disabled={pending}>
            {t("common.save")}
          </Button>
        </div>
      ) : null}
    </form>
  );
}

function Prerequisites({
  notion,
  notions,
  canWrite,
}: {
  notion: NotionData;
  notions: readonly NotionData[];
  canWrite: boolean;
}) {
  const t = useTranslations();
  const { run, pending, error } = useMutation();
  const [saved, setSaved] = useState(false);
  const [selected, setSelected] = useState<string[]>([...notion.prerequisites]);
  const byId = new Map(notions.map((n) => [n.id, n]));
  // Les notions archivées ne se proposent pas, mais un prérequis déjà posé reste visible.
  const candidates = notions
    .filter(
      (n) =>
        n.id !== notion.id &&
        (!n.archived || notion.prerequisites.includes(n.id)),
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  const toggle = (id: string, on: boolean) => {
    setSaved(false);
    setSelected((s) => (on ? [...s, id] : s.filter((x) => x !== id)));
  };

  async function save() {
    setSaved(
      (
        await run(
          "PUT",
          `/admin/curriculum/notions/${notion.id}/prerequisites`,
          { prerequisites: selected },
        )
      ).ok,
    );
  }

  return (
    <div className="w-stack">
      <div>
        <div className="w-field__label">{t("curriculum.prerequisites")}</div>
        <div className="w-field__hint">{t("curriculum.prerequisitesHint")}</div>
      </div>
      {canWrite ? (
        candidates.length === 0 ? (
          <EmptyState>{t("curriculum.noPrerequisites")}</EmptyState>
        ) : (
          <div className="w-grid w-grid--narrow" style={{ gap: 6 }}>
            {candidates.map((n) => (
              <Checkbox
                key={n.id}
                label={
                  <>
                    {n.name} <code className="w-muted w-small">{n.code}</code>
                  </>
                }
                checked={selected.includes(n.id)}
                onChange={(e) => toggle(n.id, e.target.checked)}
              />
            ))}
          </div>
        )
      ) : notion.prerequisites.length === 0 ? (
        <span className="w-muted">{t("curriculum.noPrerequisites")}</span>
      ) : (
        <div className="w-row">
          {notion.prerequisites.map((id) => (
            <Badge key={id}>{byId.get(id)?.name ?? id}</Badge>
          ))}
        </div>
      )}
      {error ? <Alert tone="error">{error}</Alert> : null}
      {saved ? <Alert tone="success">{t("common.saved")}</Alert> : null}
      {canWrite ? (
        <div>
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={save}
          >
            {t("curriculum.savePrerequisites")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function Misconceptions({
  notion,
  canWrite,
}: {
  notion: NotionData;
  canWrite: boolean;
}) {
  const t = useTranslations();
  const { run, pending, error } = useMutation();
  const [description, setDescription] = useState("");
  const [editing, setEditing] = useState<{
    id: string;
    description: string;
  } | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const visible = notion.misconceptions.filter(
    (m) => showArchived || !m.archived,
  );
  const hasArchived = notion.misconceptions.some((m) => m.archived);

  async function add(e: FormEvent) {
    e.preventDefault();
    const result = await run(
      "POST",
      `/admin/curriculum/notions/${notion.id}/misconceptions`,
      { description },
    );
    if (result.ok) setDescription("");
  }

  async function update(
    id: string,
    body: { description: string; archived?: boolean },
  ) {
    if ((await run("PATCH", `/admin/curriculum/misconceptions/${id}`, body)).ok)
      setEditing(null);
  }

  return (
    <div className="w-stack">
      <div>
        <div className="w-field__label">{t("curriculum.misconceptions")}</div>
        <div className="w-field__hint">
          {t("curriculum.misconceptionsHint")}
        </div>
      </div>
      {hasArchived ? (
        <Checkbox
          label={t("common.showArchived")}
          checked={showArchived}
          onChange={(e) => setShowArchived(e.target.checked)}
        />
      ) : null}
      {visible.length === 0 ? (
        <span className="w-muted">{t("curriculum.noMisconceptions")}</span>
      ) : (
        <ul className="w-stack" style={{ margin: 0, paddingLeft: 18, gap: 8 }}>
          {visible.map((m) =>
            editing?.id === m.id ? (
              <li key={m.id} className="w-stack">
                <TextAreaField
                  label={t("common.description")}
                  value={editing.description}
                  onChange={(e) =>
                    setEditing({ ...editing, description: e.target.value })
                  }
                />
                <div className="w-row">
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      update(m.id, {
                        description: editing.description,
                        archived: m.archived,
                      })
                    }
                  >
                    {t("common.save")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditing(null)}
                  >
                    {t("common.cancel")}
                  </Button>
                </div>
              </li>
            ) : (
              <li key={m.id}>
                <div
                  className="w-row"
                  style={{
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <span className="w-grow">
                    {m.description}{" "}
                    {m.archived ? (
                      <Badge tone="grey">{t("common.archived")}</Badge>
                    ) : null}
                  </span>
                  {canWrite ? (
                    <div className="w-row">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setEditing({ id: m.id, description: m.description })
                        }
                      >
                        {t("common.edit")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() =>
                          update(m.id, {
                            description: m.description,
                            archived: !m.archived,
                          })
                        }
                      >
                        {m.archived ? t("common.restore") : t("common.archive")}
                      </Button>
                    </div>
                  ) : null}
                </div>
              </li>
            ),
          )}
        </ul>
      )}
      {error ? <Alert tone="error">{error}</Alert> : null}
      {canWrite ? (
        <form
          className="w-row"
          onSubmit={add}
          style={{ alignItems: "flex-end" }}
        >
          <div className="w-grow">
            <TextField
              label={t("curriculum.newMisconception")}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <Button type="submit" size="sm" disabled={pending}>
            {t("common.add")}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
