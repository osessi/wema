"use client";

import {
  BookOpenText,
  ChatsTeardrop,
  Shapes,
  SpeakerHigh,
  TextAa,
} from "@phosphor-icons/react";
import type { GlowTone } from "@wema/ui/brand";
import { Badge } from "@wema/ui/components/ui/badge";
import { ChoiceCards } from "@wema/ui/components/wema/choice-cards";
import { useTranslations } from "next-intl";
import type { PresentationFormat } from "../../lib/formats-types";

const VISUALS: Record<
  PresentationFormat,
  { icon: typeof TextAa; tone: GlowTone }
> = {
  text: { icon: TextAa, tone: "slate" },
  easy_reading: { icon: BookOpenText, tone: "mint" },
  diagram: { icon: Shapes, tone: "sky" },
  comics: { icon: ChatsTeardrop, tone: "rose" },
  audio: { icon: SpeakerHigh, tone: "amber" },
};

/**
 * Sélecteur de format : une carte de choix par format possible (radios,
 * flèches du clavier comprises), le conseillé signalé par une pastille jaune.
 */
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
    <ChoiceCards
      aria-label={label}
      size="compact"
      columns={formats.length % 2 === 0 ? 2 : 3}
      value={value}
      onValueChange={(v) => {
        const next = formats.find((f) => f === v);
        if (next) onChange(next);
      }}
      options={formats.map((f) => {
        const { icon: Icon, tone } = VISUALS[f];
        return {
          value: f,
          title: t(`names.${f}`),
          description:
            f === recommended ? (
              <Badge variant="brand" className="mt-0.5">
                {t("picker.recommended")}
              </Badge>
            ) : undefined,
          icon: <Icon weight="fill" />,
          tone,
        };
      })}
    />
  );
}
