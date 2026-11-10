"use client";

import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import { SubjectIcon } from "@wema/ui/components/wema/subject-icon";
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
  // Sans choix du parent, on part du programme suivi en classe : même pays,
  // même niveau. Sinon le formulaire s'ouvrirait vide.
  const first = own[0] ?? child.programs[0];
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
    <li className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-3 font-medium">
          <span
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-ink-on-brand"
          >
            {child.displayName.charAt(0).toUpperCase()}
          </span>
          {child.displayName}
        </p>
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
            <li key={p.programId} className="min-w-0 max-w-full">
              <Badge
                variant="info"
                className="h-auto max-w-full gap-1.5 whitespace-normal py-0.5 pl-0.5 text-left"
              >
                <SubjectIcon icon={p.subjectIcon} size={20} />
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
        <div className="flex flex-col gap-3 rounded-[10px] border bg-card p-3">
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
