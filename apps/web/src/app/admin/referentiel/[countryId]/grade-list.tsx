"use client";

import { GraduationCap, Plus } from "@phosphor-icons/react";
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
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { useMutation } from "../../../../lib/use-mutation";
import { Notice, TextField } from "../../_ui/fields";
import { Code } from "../../_ui/kit";

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
    <div className="flex flex-col">
      {grades.length === 0 ? (
        <div className="border-t px-4 sm:px-6">
          <EmptyState
            variant="inline"
            icon={<GraduationCap weight="fill" />}
            tone="mint"
            title={t("curriculum.noGrades")}
            titleAs="p"
          />
        </div>
      ) : (
        <div>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-20">{t("common.position")}</TableHead>
                <TableHead>{t("curriculum.gradeName")}</TableHead>
                <TableHead className="text-right">
                  {canWrite ? t("common.actions") : ""}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grades.map((g) =>
                editing?.id === g.id ? (
                  <TableRow key={g.id}>
                    <TableCell className="w-24 align-top">
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
                    <TableCell className="align-bottom">
                      <div className="flex flex-wrap items-center justify-end gap-2">
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
                    <TableCell>
                      <Code className="tabular-nums">
                        {String(g.position + 1).padStart(2, "0")}
                      </Code>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2 font-medium">
                        {g.name}
                        {g.archived ? (
                          <Badge variant="neutral">
                            {t("common.archived")}
                          </Badge>
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell>
                      {canWrite ? (
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
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
      {error ? (
        <div className="px-4 pb-4 sm:px-6">
          <Notice tone="error">{error}</Notice>
        </div>
      ) : null}
      {canWrite ? (
        <form
          className="grid gap-3 border-t bg-muted/30 px-4 py-4 sm:grid-cols-[1fr_auto] sm:items-end sm:px-6"
          onSubmit={add}
        >
          <TextField
            label={t("curriculum.gradeName")}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button type="submit" disabled={pending}>
            <Plus aria-hidden weight="bold" />
            {t("common.add")}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
