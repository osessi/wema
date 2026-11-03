"use client";

import { Alert, Badge, Button, EmptyState, Table, TextField } from "@wema/ui";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { useMutation } from "../../../../lib/use-mutation";

interface Grade {
  id: string;
  name: string;
  position: number;
  archived: boolean;
}

export function GradeList({
  countryId,
  grades,
  canWrite,
}: {
  countryId: string;
  grades: readonly Grade[];
  canWrite: boolean;
}) {
  const t = useTranslations();
  const { run, pending, error } = useMutation();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<{
    id: string;
    name: string;
    position: number;
  } | null>(null);

  async function add(e: FormEvent) {
    e.preventDefault();
    const position = grades.reduce(
      (max, g) => Math.max(max, g.position + 1),
      0,
    );
    if (
      (
        await run("POST", `/admin/curriculum/countries/${countryId}/grades`, {
          name,
          position,
        })
      ).ok
    )
      setName("");
  }

  async function save(grade: Grade, changes: Partial<Grade>) {
    const result = await run("PATCH", `/admin/curriculum/grades/${grade.id}`, {
      name: changes.name ?? grade.name,
      position: changes.position ?? grade.position,
      archived: changes.archived ?? grade.archived,
    });
    if (result.ok) setEditing(null);
  }

  return (
    <div className="w-stack">
      {grades.length === 0 ? (
        <EmptyState>{t("curriculum.noGrades")}</EmptyState>
      ) : (
        <Table
          head={[
            t("common.position"),
            t("curriculum.gradeName"),
            canWrite ? t("common.actions") : "",
          ]}
        >
          {grades.map((g) =>
            editing?.id === g.id ? (
              <tr key={g.id}>
                <td style={{ width: 110 }}>
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
                </td>
                <td>
                  <TextField
                    label={t("curriculum.gradeName")}
                    value={editing.name}
                    onChange={(e) =>
                      setEditing({ ...editing, name: e.target.value })
                    }
                  />
                </td>
                <td>
                  <div className="w-row">
                    <Button
                      size="sm"
                      disabled={pending}
                      onClick={() => save(g, editing)}
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
                </td>
              </tr>
            ) : (
              <tr key={g.id}>
                <td style={{ width: 110 }}>{g.position + 1}</td>
                <td>
                  {g.name}{" "}
                  {g.archived ? (
                    <Badge tone="grey">{t("common.archived")}</Badge>
                  ) : null}
                </td>
                <td>
                  {canWrite ? (
                    <div className="w-row">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setEditing(g)}
                      >
                        {t("common.edit")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => save(g, { archived: !g.archived })}
                      >
                        {g.archived ? t("common.restore") : t("common.archive")}
                      </Button>
                    </div>
                  ) : null}
                </td>
              </tr>
            ),
          )}
        </Table>
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
              label={t("curriculum.gradeName")}
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={pending}>
            {t("common.add")}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
