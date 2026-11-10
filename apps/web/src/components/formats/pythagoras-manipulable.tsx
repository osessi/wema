"use client";

import { Toggle } from "@wema/ui/components/ui/toggle";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { RightTriangleDrawing } from "./figure";

type SideKey = "ab" | "ac" | "bc";

/**
 * Triangle de Pythagore manipulable : on fait apparaître le carré construit
 * sur chaque côté pour voir que les deux petits carrés, ensemble, ont la même
 * aire que le grand. Les aires ne sont pas calculées à la place de l'élève :
 * on écrit seulement « 3 × 3 », ou « ? » pour le côté cherché.
 */
export function PythagorasManipulable({
  legs,
  hypotenuse,
  onUse,
}: {
  legs: readonly [number | null, number | null];
  hypotenuse: number | null;
  onUse: () => void;
}) {
  const t = useTranslations("formats.pythagoras");
  const [shown, setShown] = useState<SideKey[]>([]);
  const lengths: Record<SideKey, number | null> = {
    ab: legs[0],
    ac: legs[1],
    bc: hypotenuse,
  };
  const area = (k: SideKey) => {
    const v = lengths[k];
    return v === null ? "?" : `${v} × ${v}`;
  };
  const sides: SideKey[] = ["ab", "ac", "bc"];
  return (
    <div className="space-y-4">
      <svg
        viewBox="-130 -140 400 400"
        role="img"
        aria-label={t("drawing", { count: shown.length })}
        className="mx-auto h-auto w-full max-w-sm"
      >
        <RightTriangleDrawing
          legs={legs}
          hypotenuse={hypotenuse}
          squares={shown}
        />
      </svg>
      <fieldset className="m-0 flex flex-wrap gap-2 border-0 p-0">
        <legend className="sr-only">{t("squares")}</legend>
        {sides.map((k) => (
          <Toggle
            key={k}
            variant="outline"
            size="sm"
            pressed={shown.includes(k)}
            onPressedChange={(on) => {
              setShown((s) => (on ? [...s, k] : s.filter((x) => x !== k)));
              if (on) onUse();
            }}
          >
            {t(`side.${k}`)}
          </Toggle>
        ))}
      </fieldset>
      <ul className="space-y-1 text-sm" aria-live="polite">
        {shown.map((k) => (
          <li key={k}>{t("area", { side: t(`name.${k}`), value: area(k) })}</li>
        ))}
      </ul>
      {shown.length === 3 && (
        <p className="rounded-lg border bg-muted p-3 text-sm">{t("theorem")}</p>
      )}
    </div>
  );
}
