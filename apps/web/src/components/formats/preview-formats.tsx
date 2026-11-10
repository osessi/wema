"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { PresentationFormat } from "../../lib/formats-types";
import { previewVariant } from "./client";
import { Comics } from "./comics";
import { Figure } from "./figure";
import { FormatPicker } from "./format-picker";
import { EasyReadingView } from "./statement-views";

type Preview = NonNullable<Awaited<ReturnType<typeof previewVariant>>>;

const FORMATS: PresentationFormat[] = [
  "text",
  "diagram",
  "easy_reading",
  "comics",
];

/**
 * Aperçu prof d'une même variante (même graine) dans les autres formats :
 * schéma tiré des paramètres, lecture facile et BD reformulées par l'IA, avec
 * les mêmes contrôles que pour l'élève. Le texte est affiché par l'aperçu lui-même.
 */
export function PreviewFormats({
  orgId,
  exerciseId,
  level,
  scaffolded,
  seed,
  hasFigure,
}: {
  orgId: string;
  exerciseId: string;
  level: 1 | 2 | 3;
  scaffolded: boolean;
  seed: number;
  hasFigure: boolean;
}) {
  const t = useTranslations("formats");
  const [format, setFormat] = useState<PresentationFormat>("text");
  const [data, setData] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);

  // Une nouvelle variante (autre graine, autre niveau) : on revient au texte.
  // biome-ignore lint/correctness/useExhaustiveDependencies: réinitialisation voulue à chaque variante
  useEffect(() => {
    setFormat("text");
    setData(null);
  }, [seed, level, scaffolded]);

  async function choose(f: PresentationFormat) {
    setFormat(f);
    setData(null);
    if (f === "text" || f === "audio") return;
    setLoading(true);
    const r = await previewVariant({
      orgId,
      exerciseId,
      level,
      scaffolded,
      seed,
      ...(f === "comics" || f === "easy_reading" ? { format: f } : {}),
    });
    setLoading(false);
    setData(r);
  }

  const formats = FORMATS.filter((f) => f !== "diagram" || hasFigure);
  const rendering = data?.rendering ?? null;
  const rendered = data?.variant.rendered ?? {};
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{t("picker.teacherLabel")}</p>
      <FormatPicker
        formats={formats}
        value={format}
        recommended={null}
        label={t("picker.teacherLabel")}
        onChange={choose}
      />
      {loading && (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      )}
      {!loading && format === "diagram" && data?.figure && (
        <div className="flex justify-center rounded-lg border p-3">
          <Figure figure={data.figure} />
        </div>
      )}
      {!loading && rendering?.status === "fallback" && (
        <p className="text-sm text-muted-foreground">{t("fallback")}</p>
      )}
      {!loading && rendering?.easyReading && (
        <EasyReadingView content={rendering.easyReading} rendered={rendered} />
      )}
      {!loading && rendering?.status === "ok" && rendering.comics && (
        <Comics comics={rendering.comics} rendered={rendered} />
      )}
    </div>
  );
}
