import { Handshake } from "@phosphor-icons/react/ssr";
import { getFormatter, getTranslations } from "next-intl/server";
import { Section } from "../guardian/section";

const FIELDS = [
  "since",
  "where",
  "blockers",
  "motivation",
  "learningStyle",
  "needs",
] as const;

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
      <dl className="grid gap-4 sm:grid-cols-2">
        {filled.map((f) => (
          <div key={f} className="flex flex-col gap-1">
            <dt className="text-xs font-medium text-muted-foreground uppercase">
              {t(`sheet.fields.${f}`)}
            </dt>
            <dd className="text-sm whitespace-pre-line">{latest.sheet[f]}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}
