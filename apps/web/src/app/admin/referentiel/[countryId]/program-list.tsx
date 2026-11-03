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
import Link from "next/link";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { useMutation } from "../../../../lib/use-mutation";
import { EmptyState, Notice, SelectField } from "../../_ui/fields";

interface Program {
  id: string;
  gradeId: string;
  subjectId: string;
  archived: boolean;
  notionCount: number;
}

export function ProgramList({
  countryId,
  programs,
  grades,
  subjects,
  canWrite,
}: {
  countryId: string;
  programs: Program[];
  grades: readonly {
    id: string;
    name: string;
    position: number;
    archived: boolean;
  }[];
  subjects: readonly { id: string; name: string; archived: boolean }[];
  canWrite: boolean;
}) {
  const t = useTranslations();
  const { run, pending, error } = useMutation();
  const activeGrades = grades.filter((g) => !g.archived);
  const activeSubjects = subjects.filter((s) => !s.archived);
  const [gradeId, setGradeId] = useState(activeGrades[0]?.id ?? "");
  const [subjectId, setSubjectId] = useState(activeSubjects[0]?.id ?? "");
  const gradeOf = new Map(grades.map((g) => [g.id, g]));
  const subjectOf = new Map(subjects.map((s) => [s.id, s]));
  const sorted = [...programs].sort(
    (a, b) =>
      (gradeOf.get(a.gradeId)?.position ?? 0) -
        (gradeOf.get(b.gradeId)?.position ?? 0) ||
      (subjectOf.get(a.subjectId)?.name ?? "").localeCompare(
        subjectOf.get(b.subjectId)?.name ?? "",
      ),
  );

  async function add(e: FormEvent) {
    e.preventDefault();
    await run("POST", "/admin/curriculum/programs", { gradeId, subjectId });
  }

  return (
    <div className="flex flex-col gap-4">
      {sorted.length === 0 ? (
        <EmptyState>{t("curriculum.noPrograms")}</EmptyState>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("curriculum.grade")}</TableHead>
                <TableHead>{t("curriculum.subject")}</TableHead>
                <TableHead />
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{gradeOf.get(p.gradeId)?.name}</TableCell>
                  <TableCell>
                    {subjectOf.get(p.subjectId)?.name}{" "}
                    {p.archived ? (
                      <Badge variant="outline">{t("common.archived")}</Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {t("curriculum.notionsCount", { count: p.notionCount })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="outline" size="sm">
                      <Link
                        href={`/admin/referentiel/${countryId}/programmes/${p.id}`}
                      >
                        {t("common.open")}
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {error ? <Notice tone="error">{error}</Notice> : null}
      {canWrite ? (
        activeSubjects.length === 0 || activeGrades.length === 0 ? (
          <Notice tone="warning">
            {activeSubjects.length === 0
              ? t("curriculum.noSubjects")
              : t("curriculum.noGrades")}
          </Notice>
        ) : (
          <form className="flex flex-wrap items-end gap-2" onSubmit={add}>
            <SelectField
              label={t("curriculum.grade")}
              className="min-w-40"
              value={gradeId}
              onChange={(e) => setGradeId(e.target.value)}
            >
              {activeGrades.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </SelectField>
            <SelectField
              label={t("curriculum.subject")}
              className="min-w-40"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
            >
              {activeSubjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </SelectField>
            <Button type="submit" disabled={pending}>
              {t("curriculum.newProgram")}
            </Button>
          </form>
        )
      ) : null}
    </div>
  );
}
