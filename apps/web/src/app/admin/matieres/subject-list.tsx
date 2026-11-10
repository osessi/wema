"use client";

import { Books, Plus } from "@phosphor-icons/react";
import type { SubjectIconKey } from "@wema/domain";
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
import { SubjectLabel } from "@wema/ui/components/wema/subject-icon";
import { useTranslations } from "next-intl";
import { type FormEvent, Fragment, useState } from "react";
import type { SubjectList as Subjects } from "../../../lib/types";
import { useMutation } from "../../../lib/use-mutation";
import { Notice, TextField } from "../_ui/fields";
import { Code } from "../_ui/kit";
import { SubjectIconPicker } from "./icon-picker";

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
  const empty: { code: string; name: string; icon: SubjectIconKey | null } = {
    code: "",
    name: "",
    icon: null,
  };
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<{
    id: string;
    name: string;
    icon: SubjectIconKey | null;
  } | null>(null);

  async function add(e: FormEvent) {
    e.preventDefault();
    if ((await run("POST", "/admin/curriculum/subjects", form)).ok)
      setForm(empty);
  }

  async function save(
    subject: Subject,
    changes: {
      name?: string;
      icon?: SubjectIconKey | null;
      archived?: boolean;
    },
  ) {
    const result = await run(
      "PATCH",
      `/admin/curriculum/subjects/${subject.id}`,
      {
        name: changes.name ?? subject.name,
        icon: changes.icon === undefined ? subject.icon : changes.icon,
        archived: changes.archived ?? subject.archived,
      },
    );
    if (result.ok) setEditing(null);
  }

  return (
    <div className="flex flex-col">
      {subjects.length === 0 ? (
        <div className="border-t px-4 sm:px-6">
          <EmptyState
            variant="inline"
            icon={<Books weight="fill" />}
            tone="sky"
            title={t("subjects.none")}
            titleAs="p"
          />
        </div>
      ) : (
        <Table className="min-w-[520px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-32">{t("common.code")}</TableHead>
              <TableHead>{t("common.name")}</TableHead>
              <TableHead className="text-right">
                {canWrite ? t("common.actions") : ""}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subjects.map((s) => (
              <Fragment key={s.id}>
                <TableRow
                  className={editing?.id === s.id ? "border-b-0" : undefined}
                >
                  <TableCell>
                    <Code>{s.code}</Code>
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
                      <span className="flex items-center gap-2 font-medium">
                        <SubjectLabel icon={s.icon}>{s.name}</SubjectLabel>
                        {s.archived ? (
                          <Badge variant="neutral">
                            {t("common.archived")}
                          </Badge>
                        ) : (
                          <Badge variant="success">
                            {t("subjects.active")}
                          </Badge>
                        )}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {canWrite ? (
                      editing?.id === s.id ? (
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={pending}
                            onClick={() =>
                              save(s, {
                                name: editing.name,
                                icon: editing.icon,
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
                      ) : (
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setEditing({
                                id: s.id,
                                name: s.name,
                                icon: s.icon,
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
                {editing?.id === s.id ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={3} className="whitespace-normal pt-0">
                      <SubjectIconPicker
                        value={editing.icon}
                        onChange={(icon) => setEditing({ ...editing, icon })}
                      />
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      )}
      {error ? (
        <div className="px-4 pb-4 sm:px-6">
          <Notice tone="error">{error}</Notice>
        </div>
      ) : null}
      {canWrite ? (
        <form
          className="grid gap-3 border-t bg-muted/30 px-4 py-4 sm:grid-cols-[minmax(0,14rem)_1fr] sm:items-start sm:px-6"
          onSubmit={add}
        >
          <TextField
            label={t("common.code")}
            hint={t("subjects.codeHint")}
            required
            pattern="[a-z0-9][a-z0-9\-]{0,63}"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
          />
          <TextField
            label={t("common.name")}
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <div className="sm:col-span-2">
            <SubjectIconPicker
              value={form.icon}
              onChange={(icon) => setForm({ ...form, icon })}
            />
          </div>
          <Button
            type="submit"
            disabled={pending}
            className="justify-self-start"
          >
            <Plus aria-hidden weight="bold" />
            {t("subjects.new")}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
