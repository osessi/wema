"use client";

import { Alert, Badge, Button, EmptyState, SelectField, Table } from "@wema/ui";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { useMutation } from "../../../../lib/use-mutation";

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
    <div className="w-stack">
      {sorted.length === 0 ? (
        <EmptyState>{t("curriculum.noPrograms")}</EmptyState>
      ) : (
        <Table head={[t("curriculum.grade"), t("curriculum.subject"), "", ""]}>
          {sorted.map((p) => (
            <tr key={p.id}>
              <td>{gradeOf.get(p.gradeId)?.name}</td>
              <td>
                {subjectOf.get(p.subjectId)?.name}{" "}
                {p.archived ? (
                  <Badge tone="grey">{t("common.archived")}</Badge>
                ) : null}
              </td>
              <td className="w-muted">
                {t("curriculum.notionsCount", { count: p.notionCount })}
              </td>
              <td style={{ textAlign: "right" }}>
                <Link
                  className="w-btn w-btn--secondary w-btn--sm"
                  href={`/admin/referentiel/${countryId}/programmes/${p.id}`}
                >
                  {t("common.open")}
                </Link>
              </td>
            </tr>
          ))}
        </Table>
      )}
      {error ? <Alert tone="error">{error}</Alert> : null}
      {canWrite ? (
        activeSubjects.length === 0 || activeGrades.length === 0 ? (
          <Alert tone="warning">
            {activeSubjects.length === 0
              ? t("curriculum.noSubjects")
              : t("curriculum.noGrades")}
          </Alert>
        ) : (
          <form
            className="w-row"
            onSubmit={add}
            style={{ alignItems: "flex-end" }}
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
              {t("curriculum.newProgram")}
            </Button>
          </form>
        )
      ) : null}
    </div>
  );
}
