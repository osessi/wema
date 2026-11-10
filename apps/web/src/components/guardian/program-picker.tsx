"use client";

import { Checkbox } from "@wema/ui/components/ui/checkbox";
import { Label } from "@wema/ui/components/ui/label";
import { NativeSelect } from "@wema/ui/components/ui/native-select";
import { useTranslations } from "next-intl";
import { useId } from "react";
import type { CatalogProgram } from "../../lib/family-types";

export interface ProgramChoice {
  countryId: string;
  gradeId: string;
  programIds: string[];
}

/** Choix depuis le référentiel : pays, puis classe (niveau), puis matières. */
export function ProgramPicker({
  catalog,
  value,
  onChange,
}: {
  catalog: readonly CatalogProgram[];
  value: ProgramChoice;
  onChange: (value: ProgramChoice) => void;
}) {
  const t = useTranslations("family.program");
  const id = useId();
  const countries = [
    ...new Map(catalog.map((p) => [p.countryId, p.countryName])).entries(),
  ];
  const grades = [
    ...new Map(
      catalog
        .filter((p) => p.countryId === value.countryId)
        .sort((a, b) => a.gradePosition - b.gradePosition)
        .map((p) => [p.gradeId, p.gradeName]),
    ).entries(),
  ];
  const subjects = catalog.filter(
    (p) => p.countryId === value.countryId && p.gradeId === value.gradeId,
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="grid gap-2">
        <Label htmlFor={`${id}-country`}>{t("country")}</Label>
        <NativeSelect
          id={`${id}-country`}
          required
          value={value.countryId}
          onChange={(e) =>
            onChange({ countryId: e.target.value, gradeId: "", programIds: [] })
          }
        >
          <option value="">{t("chooseCountry")}</option>
          {countries.map(([cid, name]) => (
            <option key={cid} value={cid}>
              {name}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${id}-grade`}>{t("grade")}</Label>
        <NativeSelect
          id={`${id}-grade`}
          required
          disabled={!value.countryId}
          value={value.gradeId}
          onChange={(e) =>
            onChange({ ...value, gradeId: e.target.value, programIds: [] })
          }
        >
          <option value="">{t("chooseGrade")}</option>
          {grades.map(([gid, name]) => (
            <option key={gid} value={gid}>
              {name}
            </option>
          ))}
        </NativeSelect>
      </div>
      {value.gradeId ? (
        <fieldset className="grid gap-2 sm:col-span-2">
          <legend className="text-sm font-medium">{t("subjects")}</legend>
          <p className="text-sm text-muted-foreground">{t("subjectsHint")}</p>
          {subjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("none")}</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {subjects.map((p) => {
                const checked = value.programIds.includes(p.programId);
                return (
                  <Label
                    key={p.programId}
                    htmlFor={`${id}-${p.programId}`}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border bg-card px-3 py-2 font-normal transition-colors hover:bg-muted has-[button[data-state=checked]]:border-brand has-[button[data-state=checked]]:bg-brand-soft"
                  >
                    <Checkbox
                      id={`${id}-${p.programId}`}
                      checked={checked}
                      onCheckedChange={(v) =>
                        onChange({
                          ...value,
                          programIds:
                            v === true
                              ? [...value.programIds, p.programId]
                              : value.programIds.filter(
                                  (x) => x !== p.programId,
                                ),
                        })
                      }
                    />
                    {p.subjectName}
                  </Label>
                );
              })}
            </div>
          )}
        </fieldset>
      ) : null}
    </div>
  );
}
