"use client";

import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@wema/ui/components/ui/table";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { useMutation } from "../../../../lib/use-mutation";
import { EmptyState, Notice, TextField } from "../../_ui/fields";

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
    <div className="flex flex-col gap-4">
      {grades.length === 0 ? (
        <EmptyState>{t("curriculum.noGrades")}</EmptyState>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.position")}</TableHead>
                <TableHead>{t("curriculum.gradeName")}</TableHead>
                <TableHead>{canWrite ? t("common.actions") : ""}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grades.map((g) =>
                editing?.id === g.id ? (
                  <TableRow key={g.id}>
                    <TableCell className="w-28">
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
                    </TableCell>
                    <TableCell>
                      <TextField
                        label={t("curriculum.gradeName")}
                        value={editing.name}
                        onChange={(e) =>
                          setEditing({ ...editing, name: e.target.value })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={pending}
                          onClick={() => save(g, editing)}
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
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={g.id}>
                    <TableCell className="w-28">{g.position + 1}</TableCell>
                    <TableCell>
                      {g.name}{" "}
                      {g.archived ? (
                        <Badge variant="outline">{t("common.archived")}</Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {canWrite ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setEditing(g)}
                          >
                            {t("common.edit")}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={pending}
                            onClick={() => save(g, { archived: !g.archived })}
                          >
                            {g.archived
                              ? t("common.restore")
                              : t("common.archive")}
                          </Button>
                        </div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ),
              )}
            </TableBody>
          </Table>
        </div>
      )}
      {error ? <Notice tone="error">{error}</Notice> : null}
      {canWrite ? (
        <form className="flex flex-wrap items-end gap-2" onSubmit={add}>
          <div className="flex-1">
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
