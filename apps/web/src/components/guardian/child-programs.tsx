"use client";

import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { CatalogProgram, FamilyChild } from "../../lib/family-types";
import { useMutation } from "../../lib/use-mutation";
import { type ProgramChoice, ProgramPicker } from "./program-picker";

/** Programme d'un enfant : ce qu'il suit, et le choix du parent (modifiable). */
export function ChildPrograms({
  familyId,
  child,
  catalog,
}: {
  familyId: string;
  child: FamilyChild;
  catalog: readonly CatalogProgram[];
}) {
  const t = useTranslations("family.program");
  const { run, pending, error } = useMutation();
  const own = child.programs.filter((p) => p.source === "individual");
  const first = own[0];
  const [editing, setEditing] = useState(false);
  const [choice, setChoice] = useState<ProgramChoice>({
    countryId: first?.countryId ?? "",
    gradeId: first?.gradeId ?? "",
    programIds: own.map((p) => p.programId),
  });

  async function save() {
    const result = await run(
      "PUT",
      `/family/${familyId}/children/${child.learnerId}/programs`,
      { programIds: choice.programIds },
    );
    if (result.ok) setEditing(false);
  }

  return (
    <li className="space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">{child.displayName}</p>
        {!editing && (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            {t("edit")}
          </Button>
        )}
      </div>
      {child.programs.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {child.programs.map((p) => (
            <li key={p.programId}>
              <Badge variant="secondary">
                {t("summary", {
                  subject: p.subjectName,
                  grade: p.gradeName,
                  country: p.countryName,
                })}
                {p.className
                  ? ` · ${t("fromClass", { name: p.className })}`
                  : ""}
              </Badge>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <div className="space-y-3 rounded-md border p-3">
          <ProgramPicker
            catalog={catalog}
            value={choice}
            onChange={setChoice}
          />
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button size="sm" disabled={pending} onClick={() => void save()}>
              {t("save")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => setEditing(false)}
            >
              {t("cancel")}
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
