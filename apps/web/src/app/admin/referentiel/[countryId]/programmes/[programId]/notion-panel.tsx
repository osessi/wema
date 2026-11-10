"use client";

import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import type { NotionData, UnitData } from "../../../../../../lib/types";
import { useMutation } from "../../../../../../lib/use-mutation";
import {
  CheckboxField,
  Notice,
  SelectField,
  TextAreaField,
  TextField,
} from "../../../../_ui/fields";
import { Code } from "../../../../_ui/kit";

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
    <div className="flex flex-col divide-y rounded-card border bg-card">
      <section className="flex flex-col gap-4 p-3 sm:p-4">
        <h3 className="font-mono text-[11px] font-medium tracking-[0.06em] text-muted-foreground uppercase">
          {t("curriculum.editNotion")}
        </h3>
        <NotionFields notion={notion} units={units} canWrite={canWrite} />
      </section>
      <section className="p-3 sm:p-4">
        <Prerequisites notion={notion} notions={notions} canWrite={canWrite} />
      </section>
      <section className="p-3 sm:p-4">
        <Misconceptions notion={notion} canWrite={canWrite} />
      </section>
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
    <form className="flex flex-col gap-4" onSubmit={submit}>
      <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
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
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <CheckboxField
          label={t("curriculum.verified")}
          disabled={!canWrite}
          checked={values.verified}
          onCheckedChange={(verified) => setValues({ ...values, verified })}
        />
        <CheckboxField
          label={t("common.archived")}
          disabled={!canWrite}
          checked={values.archived}
          onCheckedChange={(archived) => setValues({ ...values, archived })}
        />
      </div>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {saved ? <Notice tone="success">{t("common.saved")}</Notice> : null}
      {canWrite ? (
        <div className="flex justify-end">
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
    <div className="flex flex-col gap-4">
      <div className="space-y-1">
        <h3 className="font-mono text-[11px] font-medium tracking-[0.06em] text-muted-foreground uppercase">
          {t("curriculum.prerequisites")}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t("curriculum.prerequisitesHint")}
        </p>
      </div>
      {canWrite ? (
        candidates.length === 0 ? (
          <EmptyState
            variant="inline"
            title={t("curriculum.noPrerequisites")}
            titleAs="p"
          />
        ) : (
          <div className="grid max-h-72 gap-2.5 overflow-y-auto rounded-lg border bg-muted/30 p-3 sm:grid-cols-2">
            {candidates.map((n) => (
              <CheckboxField
                key={n.id}
                label={
                  <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    {n.name}
                    <Code className="text-[11px] text-muted-foreground">
                      {n.code}
                    </Code>
                  </span>
                }
                checked={selected.includes(n.id)}
                onCheckedChange={(on) => toggle(n.id, on)}
              />
            ))}
          </div>
        )
      ) : notion.prerequisites.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("curriculum.noPrerequisites")}
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {notion.prerequisites.map((id) => (
            <Badge key={id} variant="info">
              {byId.get(id)?.name ?? id}
            </Badge>
          ))}
        </div>
      )}
      {error ? <Notice tone="error">{error}</Notice> : null}
      {saved ? <Notice tone="success">{t("common.saved")}</Notice> : null}
      {canWrite ? (
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            variant="outline"
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
    <div className="flex flex-col gap-4">
      <div className="space-y-1">
        <h3 className="font-mono text-[11px] font-medium tracking-[0.06em] text-muted-foreground uppercase">
          {t("curriculum.misconceptions")}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t("curriculum.misconceptionsHint")}
        </p>
      </div>
      {hasArchived ? (
        <CheckboxField
          label={t("common.showArchived")}
          checked={showArchived}
          onCheckedChange={setShowArchived}
        />
      ) : null}
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("curriculum.noMisconceptions")}
        </p>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">
          {visible.map((m) =>
            editing?.id === m.id ? (
              <li key={m.id} className="flex flex-col gap-4 p-3">
                <TextAreaField
                  label={t("common.description")}
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
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditing(null)}
                  >
                    {t("common.cancel")}
                  </Button>
                </div>
              </li>
            ) : (
              <li key={m.id} className="px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex min-w-[min(100%,14rem)] flex-1 flex-wrap items-center gap-2 text-sm">
                    {m.description}
                    {m.archived ? (
                      <Badge variant="neutral">{t("common.archived")}</Badge>
                    ) : null}
                  </span>
                  {canWrite ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setEditing({ id: m.id, description: m.description })
                        }
                      >
                        {t("common.edit")}
                      </Button>
                      <Button
                        type="button"
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
      {error ? <Notice tone="error">{error}</Notice> : null}
      {canWrite ? (
        <form
          className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
          onSubmit={add}
        >
          <TextField
            label={t("curriculum.newMisconception")}
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Button type="submit" disabled={pending}>
            {t("common.add")}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
