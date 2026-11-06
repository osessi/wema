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
import type { SubjectList as Subjects } from "../../../lib/types";
import { useMutation } from "../../../lib/use-mutation";
import { EmptyState, Notice, TextField } from "../_ui/fields";

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
    <div className="flex flex-col gap-4">
      {subjects.length === 0 ? (
        <EmptyState>{t("subjects.none")}</EmptyState>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.code")}</TableHead>
              <TableHead>{t("common.name")}</TableHead>
              <TableHead>{canWrite ? t("common.actions") : ""}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subjects.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <code className="text-xs">{s.code}</code>
                </TableCell>
                <TableCell>
                  {editing?.id === s.id ? (
                    <TextField
                      label={t("common.name")}
                      value={editing.name}
                      onChange={(e) =>
                        setEditing({ ...editing, name: e.target.value })
                      }
                    />
                  ) : (
                    <span className="flex items-center gap-2">
                      {s.name}
                      {s.archived ? (
                        <Badge variant="outline">{t("common.archived")}</Badge>
                      ) : null}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {canWrite ? (
                    editing?.id === s.id ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={pending}
                          onClick={() => save(s, { name: editing.name })}
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
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setEditing({ id: s.id, name: s.name })}
                        >
                          {t("common.edit")}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={pending}
                          onClick={() => save(s, { archived: !s.archived })}
                        >
                          {s.archived
                            ? t("common.restore")
                            : t("common.archive")}
                        </Button>
                      </div>
                    )
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {error ? <Notice tone="error">{error}</Notice> : null}
      {canWrite ? (
        <form className="flex flex-wrap items-end gap-3" onSubmit={add}>
          <TextField
            label={t("common.code")}
            hint={t("subjects.codeHint")}
            required
            pattern="[a-z0-9][a-z0-9\-]{0,63}"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
          />
          <TextField
            className="min-w-48 flex-1"
            label={t("common.name")}
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Button type="submit" disabled={pending}>
            {t("subjects.new")}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
