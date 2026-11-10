"use client";

import {
  Archive,
  ArrowCounterClockwise,
  PencilSimple,
  Plus,
} from "@phosphor-icons/react";
import type { SubjectIconKey } from "@wema/domain";
import { ILLUSTRATION_FOR } from "@wema/ui/components/illustrations/illustration";
import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import { Card } from "@wema/ui/components/ui/card";
import { FieldSection } from "@wema/ui/components/ui/field";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import { SubjectIcon } from "@wema/ui/components/wema/subject-icon";
import { cn } from "@wema/ui/lib/utils";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
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
  const [editing, setEditing] = useState<{
    id: string;
    name: string;
    icon: SubjectIconKey | null;
  } | null>(null);

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
    <div className="flex flex-col gap-4">
      {subjects.length === 0 ? (
        <EmptyState
          variant="inline"
          illustration={ILLUSTRATION_FOR.emptyExercises}
          title={t("subjects.none")}
          titleAs="p"
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {subjects.map((s) => {
            const open = editing?.id === s.id;
            return (
              <li
                key={s.id}
                className={cn("min-w-0", open && "sm:col-span-2 xl:col-span-3")}
              >
                <Card
                  variant="flat"
                  className={cn(
                    "h-full gap-4 p-4",
                    s.archived && "bg-muted/40",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <SubjectIcon
                      icon={open ? editing.icon : s.icon}
                      size={44}
                      lit={!s.archived}
                    />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      {open ? (
                        <TextField
                          label={t("common.name")}
                          value={editing.name}
                          onChange={(e) =>
                            setEditing({ ...editing, name: e.target.value })
                          }
                        />
                      ) : (
                        <p
                          className={cn(
                            "truncate font-semibold tracking-tight",
                            s.archived && "text-muted-foreground",
                          )}
                        >
                          {s.name}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Code>{s.code}</Code>
                        {s.archived ? (
                          <Badge variant="neutral">
                            {t("common.archived")}
                          </Badge>
                        ) : (
                          <Badge variant="success">
                            {t("subjects.active")}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  {open ? (
                    <SubjectIconPicker
                      value={editing.icon}
                      onChange={(icon) => setEditing({ ...editing, icon })}
                    />
                  ) : null}
                  {canWrite ? (
                    <div className="mt-auto flex flex-wrap items-center justify-end gap-2 border-t pt-3">
                      {open ? (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditing(null)}
                          >
                            {t("common.cancel")}
                          </Button>
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
                        </>
                      ) : (
                        <>
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
                            <PencilSimple aria-hidden />
                            {t("common.edit")}
                            <span className="sr-only"> · {s.name}</span>
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={pending}
                            onClick={() => save(s, { archived: !s.archived })}
                          >
                            {s.archived ? (
                              <ArrowCounterClockwise aria-hidden />
                            ) : (
                              <Archive aria-hidden />
                            )}
                            {s.archived
                              ? t("common.restore")
                              : t("common.archive")}
                            <span className="sr-only"> · {s.name}</span>
                          </Button>
                        </>
                      )}
                    </div>
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      {error ? <Notice tone="error">{error}</Notice> : null}
    </div>
  );
}

/** Création d'une matière : code stable, nom et icône. */
export function SubjectCreateForm() {
  const t = useTranslations();
  const { run, pending, error } = useMutation();
  const empty: { code: string; name: string; icon: SubjectIconKey | null } = {
    code: "",
    name: "",
    icon: null,
  };
  const [form, setForm] = useState(empty);

  async function add(e: FormEvent) {
    e.preventDefault();
    if ((await run("POST", "/admin/curriculum/subjects", form)).ok)
      setForm(empty);
  }

  return (
    <form onSubmit={add}>
      <FieldSection
        title={t("subjects.new")}
        tone="sky"
        icon={<SubjectIcon icon={form.icon} size={36} />}
      >
        <div className="grid gap-4 sm:grid-cols-[minmax(0,14rem)_1fr] sm:items-start">
          <TextField
            label={t("common.code")}
            hint={t("subjects.codeHint")}
            required
            pattern="[a-z0-9][a-z0-9\-]{0,63}"
            className="[&_input]:font-mono"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
          />
          <TextField
            label={t("common.name")}
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <SubjectIconPicker
          value={form.icon}
          onChange={(icon) => setForm({ ...form, icon })}
        />
        {error ? <Notice tone="error">{error}</Notice> : null}
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            <Plus aria-hidden weight="bold" />
            {t("subjects.new")}
          </Button>
        </div>
      </FieldSection>
    </form>
  );
}
