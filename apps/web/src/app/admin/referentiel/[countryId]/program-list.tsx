"use client";

import { CaretRight, Plus, Stack } from "@phosphor-icons/react";
import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import { Progress } from "@wema/ui/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@wema/ui/components/ui/table";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { useMutation } from "../../../../lib/use-mutation";
import { Notice, SelectField } from "../../_ui/fields";

interface Program {
  id: string;
  gradeId: string;
  subjectId: string;
  archived: boolean;
  notionCount: number;
  verifiedCount: number;
}

const nf = new Intl.NumberFormat("fr-FR");

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
    <div className="flex flex-col">
      {sorted.length === 0 ? (
        <div className="border-t px-4 sm:px-6">
          <EmptyState
            variant="inline"
            icon={<Stack weight="fill" />}
            tone="sky"
            title={t("curriculum.noPrograms")}
            titleAs="p"
          />
        </div>
      ) : (
        <Table className="min-w-[560px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>{t("curriculum.grade")}</TableHead>
              <TableHead>{t("curriculum.subject")}</TableHead>
              <TableHead className="text-right">
                {t("curriculum.notionsLabel")}
              </TableHead>
              <TableHead>{t("curriculum.verifiedShort")}</TableHead>
              <TableHead className="w-24">
                <span className="sr-only">{t("common.actions")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((p) => {
              const ratio =
                p.notionCount > 0 ? p.verifiedCount / p.notionCount : 0;
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    {gradeOf.get(p.gradeId)?.name}
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      {subjectOf.get(p.subjectId)?.name}
                      {p.archived ? (
                        <Badge variant="neutral">{t("common.archived")}</Badge>
                      ) : null}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {nf.format(p.notionCount)}
                  </TableCell>
                  <TableCell>
                    {p.notionCount > 0 ? (
                      <span className="flex w-40 items-center gap-2">
                        <Progress
                          value={ratio * 100}
                          aria-label={t("curriculum.verifiedOf", {
                            verified: p.verifiedCount,
                            total: p.notionCount,
                          })}
                          indicatorClassName="bg-success-text"
                        />
                        <span className="w-12 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                          {nf.format(p.verifiedCount)}/
                          {nf.format(p.notionCount)}
                        </span>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">–</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link
                        href={`/admin/referentiel/${countryId}/programmes/${p.id}`}
                      >
                        {t("common.open")}
                        <CaretRight aria-hidden />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      {error ? (
        <div className="px-4 pb-4 sm:px-6">
          <Notice tone="error">{error}</Notice>
        </div>
      ) : null}
      {canWrite ? (
        <div className="border-t bg-muted/30 px-4 py-4 sm:px-6">
          {activeSubjects.length === 0 || activeGrades.length === 0 ? (
            <Notice tone="warning">
              {activeSubjects.length === 0
                ? t("curriculum.noSubjects")
                : t("curriculum.noGrades")}
            </Notice>
          ) : (
            <form
              className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
              onSubmit={add}
            >
              <SelectField
                label={t("curriculum.grade")}
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
                <Plus aria-hidden weight="bold" />
                {t("curriculum.newProgram")}
              </Button>
            </form>
          )}
        </div>
      ) : null}
    </div>
  );
}
