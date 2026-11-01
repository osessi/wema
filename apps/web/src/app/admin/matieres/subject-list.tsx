"use client";

import { Alert, Badge, Button, EmptyState, Table, TextField } from "@wema/ui";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import type { SubjectList as Subjects } from "../../../lib/types";
import { useMutation } from "../../../lib/use-mutation";

type Subject = Subjects[number];

export function SubjectList({
  subjects,
  canWrite,
}: {
  subjects: Subjects;
  canWrite: boolean;
}) {
  const t = useTranslations();
  const { run, pending, error } = useMutation();
  const [form, setForm] = useState({ code: "", name: "" });
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(
    null,
  );

  async function add(e: FormEvent) {
    e.preventDefault();
    if ((await run("POST", "/admin/curriculum/subjects", form)).ok)
      setForm({ code: "", name: "" });
  }

  async function save(
    subject: Subject,
    changes: { name?: string; archived?: boolean },
  ) {
    const result = await run(
      "PATCH",
      `/admin/curriculum/subjects/${subject.id}`,
      {
        name: changes.name ?? subject.name,
        archived: changes.archived ?? subject.archived,
      },
    );
    if (result.ok) setEditing(null);
  }

  return (
    <div className="w-stack">
      {subjects.length === 0 ? (
        <EmptyState>{t("subjects.none")}</EmptyState>
      ) : (
        <Table
          head={[
            t("common.code"),
            t("common.name"),
            canWrite ? t("common.actions") : "",
          ]}
        >
          {subjects.map((s) => (
            <tr key={s.id}>
              <td>
                <code>{s.code}</code>
              </td>
              <td>
                {editing?.id === s.id ? (
                  <TextField
                    label={t("common.name")}
                    value={editing.name}
                    onChange={(e) =>
                      setEditing({ ...editing, name: e.target.value })
                    }
                  />
                ) : (
                  <>
                    {s.name}{" "}
                    {s.archived ? (
                      <Badge tone="grey">{t("common.archived")}</Badge>
                    ) : null}
                  </>
                )}
              </td>
              <td>
                {canWrite ? (
                  editing?.id === s.id ? (
                    <div className="w-row">
                      <Button
                        size="sm"
                        disabled={pending}
                        onClick={() => save(s, { name: editing.name })}
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
                  ) : (
                    <div className="w-row">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setEditing({ id: s.id, name: s.name })}
                      >
                        {t("common.edit")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => save(s, { archived: !s.archived })}
                      >
                        {s.archived ? t("common.restore") : t("common.archive")}
                      </Button>
                    </div>
                  )
                ) : null}
              </td>
            </tr>
          ))}
        </Table>
      )}
      {error ? <Alert tone="error">{error}</Alert> : null}
      {canWrite ? (
        <form
          className="w-row"
          onSubmit={add}
          style={{ alignItems: "flex-end" }}
        >
          <TextField
            label={t("common.code")}
            hint={t("subjects.codeHint")}
            required
            pattern="[a-z0-9][a-z0-9\-]{0,63}"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
          />
          <div className="w-grow">
            <TextField
              label={t("common.name")}
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <Button type="submit" disabled={pending}>
            {t("subjects.new")}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
