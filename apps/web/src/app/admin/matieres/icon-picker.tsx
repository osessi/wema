"use client";

import {
  SUBJECT_ICONS,
  type SubjectIconKey,
  toSubjectIcon,
} from "@wema/domain";
import { RadioGroup, RadioGroupItem } from "@wema/ui/components/ui/radio-group";
import { SubjectIcon } from "@wema/ui/components/wema/subject-icon";
import { useTranslations } from "next-intl";
import { useId } from "react";

/**
 * Grille de choix de l'icône d'une matière : la liste fermée du domaine, et
 * « Aucune » (icône générique). Groupe de boutons radio, au clavier par les flèches.
 */
export function SubjectIconPicker({
  value,
  onChange,
}: {
  value: SubjectIconKey | null;
  onChange: (value: SubjectIconKey | null) => void;
}) {
  const t = useTranslations("subjects");
  const id = useId();
  const options = [
    { key: "", label: t("iconNone"), icon: null },
    ...SUBJECT_ICONS.map((key) => ({
      key,
      label: t(`icons.${key}`),
      icon: key,
    })),
  ];
  return (
    <div className="grid gap-1.5">
      <span id={`${id}-label`} className="text-sm font-medium">
        {t("icon")}
      </span>
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">
        {t("iconHint")}
      </p>
      <RadioGroup
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-hint`}
        value={value ?? ""}
        onValueChange={(v) => onChange(toSubjectIcon(v))}
        className="grid-cols-[repeat(auto-fill,minmax(6.75rem,1fr))] gap-2"
      >
        {options.map((o) => (
          <label
            key={o.key}
            htmlFor={`${id}-${o.key || "none"}`}
            className="relative flex cursor-pointer flex-col items-center gap-1.5 rounded-[12px] border bg-card px-1.5 pt-2.5 pb-2 text-center text-xs transition-colors hover:bg-muted has-[button:focus-visible]:ring-[3px] has-[button:focus-visible]:ring-brand/45 has-[button[data-state=checked]]:border-brand has-[button[data-state=checked]]:bg-brand-soft"
          >
            <RadioGroupItem
              id={`${id}-${o.key || "none"}`}
              value={o.key}
              className="sr-only"
            />
            <SubjectIcon icon={o.icon} size={32} />
            <span className="w-full truncate">{o.label}</span>
          </label>
        ))}
      </RadioGroup>
    </div>
  );
}
