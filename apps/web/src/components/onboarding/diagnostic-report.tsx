import {
  Barricade,
  ClockCounterClockwise,
  Fire,
  Handshake,
  Lightbulb,
  MapPin,
  Plant,
} from "@phosphor-icons/react/ssr";
import { GlowTile, type GlowTone } from "@wema/ui/components/brand/glow-tile";
import { getFormatter, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Section } from "../guardian/section";

const FIELDS = [
  "since",
  "where",
  "blockers",
  "motivation",
  "learningStyle",
  "needs",
] as const;

/** Pastille de chaque rubrique de la fiche. */
const FIELD_ICON: Record<
  (typeof FIELDS)[number],
  { icon: ReactNode; tone: GlowTone }
> = {
  since: { icon: <ClockCounterClockwise weight="bold" />, tone: "slate" },
  where: { icon: <MapPin weight="bold" />, tone: "sky" },
  blockers: { icon: <Barricade weight="bold" />, tone: "rose" },
  motivation: { icon: <Fire weight="bold" />, tone: "amber" },
  learningStyle: { icon: <Lightbulb weight="bold" />, tone: "yellow" },
  needs: { icon: <Plant weight="bold" />, tone: "mint" },
};

export interface DiagnosticReportData {
  eventId: string;
  at: string;
  sheet: Record<(typeof FIELDS)[number], string>;
}

/**
 * Compte rendu du rendez-vous de diagnostic (le plus récent), pour le parent
 * et les profs de l'élève. Ce sont des observations, jamais un diagnostic
 * médical ; les hypothèses qu'il apporte figurent avec les autres.
 */
export async function DiagnosticReport({
  reports,
}: {
  reports: readonly DiagnosticReportData[];
}) {
  const latest = reports.at(-1);
  if (!latest) return null;
  const t = await getTranslations("diagnostic");
  const format = await getFormatter();
  const filled = FIELDS.filter((f) => latest.sheet[f].trim() !== "");
  return (
    <Section
      eyebrow={`${t("report.eyebrow")} · ${format.dateTime(new Date(latest.at), { dateStyle: "long" })}`}
      icon={<Handshake weight="bold" />}
      tone="amber"
      title={t("report.title")}
      description={t("report.text")}
    >
      <dl className="grid gap-3 sm:grid-cols-2">
        {filled.map((f) => (
          <div
            key={f}
            className="flex gap-3 rounded-card border bg-card p-4 shadow-xs"
          >
            <GlowTile tone={FIELD_ICON[f].tone} size={32}>
              {FIELD_ICON[f].icon}
            </GlowTile>
            <div className="flex min-w-0 flex-col gap-1">
              <dt className="font-mono text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                {t(`sheet.fields.${f}`)}
              </dt>
              <dd className="text-sm text-pretty whitespace-pre-line">
                {latest.sheet[f]}
              </dd>
            </div>
          </div>
        ))}
      </dl>
    </Section>
  );
}
