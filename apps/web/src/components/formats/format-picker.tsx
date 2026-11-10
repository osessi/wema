"use client";

import {
  BookOpenText,
  ChatsTeardrop,
  Shapes,
  SpeakerHigh,
  TextAa,
} from "@phosphor-icons/react";
import { GlowTile, type GlowTone } from "@wema/ui/brand";
import { cn } from "@wema/ui/lib/utils";
import { useTranslations } from "next-intl";
import { useId } from "react";
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
 * Sélecteur de format : une tuile-icône par format possible (vrais boutons
 * radio, flèches du clavier comprises), le conseillé signalé en jaune.
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
  const name = useId();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fit,minmax(112px,1fr))]"
    >
      {formats.map((f) => {
        const { icon: Icon, tone } = VISUALS[f];
        const checked = f === value;
        return (
          <label
            key={f}
            className={cn(
              "group relative flex cursor-pointer flex-col items-center gap-2 rounded-card border bg-card px-3 pt-4 pb-3 text-center text-sm font-medium transition-[border-color,box-shadow,background-color]",
              "hover:border-foreground/25 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
              checked
                ? "border-foreground/80 shadow-[0_0_0_1px_var(--foreground)] dark:border-brand dark:shadow-[0_0_0_1px_var(--brand)]"
                : "text-muted-foreground",
            )}
          >
            <input
              type="radio"
              name={name}
              value={f}
              checked={checked}
              onChange={() => onChange(f)}
              className="sr-only"
            />
            <GlowTile tone={tone} size={36} lit={checked}>
              <Icon weight="fill" />
            </GlowTile>
            <span className={cn(checked && "text-foreground")}>
              {t(`names.${f}`)}
            </span>
            {f === recommended && (
              <span className="absolute -top-2 right-2 rounded-full bg-brand px-1.5 py-px font-mono text-[9px] font-semibold tracking-wider text-ink-on-brand uppercase">
                {t("picker.recommended")}
              </span>
            )}
          </label>
        );
      })}
    </div>
  );
}
