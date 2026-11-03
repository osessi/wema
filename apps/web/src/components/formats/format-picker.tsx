"use client";

import {
  BookOpenText,
  ChatsTeardrop,
  Shapes,
  SpeakerHigh,
  TextAa,
} from "@phosphor-icons/react";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@wema/ui/components/ui/toggle-group";
import { useTranslations } from "next-intl";
import type { PresentationFormat } from "../../lib/formats-types";

const ICONS: Record<PresentationFormat, typeof TextAa> = {
  text: TextAa,
  easy_reading: BookOpenText,
  diagram: Shapes,
  comics: ChatsTeardrop,
  audio: SpeakerHigh,
};

/** Sélecteur de format : les formats possibles, le conseillé en premier et signalé. */
export function FormatPicker({
  formats,
  value,
  recommended,
  label,
  onChange,
}: {
  formats: readonly PresentationFormat[];
  value: PresentationFormat;
  recommended: PresentationFormat | null;
  label: string;
  onChange: (format: PresentationFormat) => void;
}) {
  const t = useTranslations("formats");
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      value={value}
      aria-label={label}
      className="flex-wrap justify-start"
      onValueChange={(v) => {
        const f = formats.find((x) => x === v);
        if (f) onChange(f);
      }}
    >
      {formats.map((f) => {
        const Icon = ICONS[f];
        return (
          <ToggleGroupItem key={f} value={f} className="gap-1.5 px-3">
            <Icon aria-hidden="true" />
            {t(`names.${f}`)}
            {f === recommended && (
              <span className="rounded-full bg-brand-soft px-1.5 text-[0.7rem] font-semibold">
                {t("picker.recommended")}
              </span>
            )}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
