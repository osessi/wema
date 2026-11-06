import { Badge } from "@wema/ui/components/ui/badge";
import { Progress } from "@wema/ui/components/ui/progress";
import { useTranslations } from "next-intl";
import type { ProfileHypothesis } from "../../lib/guardian-types";

/** Hypothèses sur la façon d'apprendre : chacune avec sa source, sa confiance et ses preuves. */
export function HypothesesList({
  hypotheses,
}: {
  hypotheses: ProfileHypothesis[];
}) {
  const t = useTranslations("guardian.profile");
  if (hypotheses.length === 0)
    return <p className="text-sm text-muted-foreground">{t("noHypotheses")}</p>;
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {hypotheses.map((h) => {
        const confidence = Math.round(h.confidence * 100);
        return (
          <li key={h.key} className="space-y-3 rounded-lg border p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="font-medium">{h.statement}</p>
              <Badge variant={h.status === "supported" ? "default" : "outline"}>
                {t(`hypothesisStatus.${h.status}`)}
              </Badge>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{t("confidence")}</span>
                <span className="tabular-nums">{confidence} %</span>
              </div>
              <Progress value={confidence} aria-label={t("confidence")} />
            </div>
            <dl className="grid gap-1 text-sm">
              <div className="flex flex-wrap gap-1">
                <dt className="text-muted-foreground">{t("sources")}</dt>
                <dd>{h.sources.map((s) => t(`source.${s}`)).join(", ")}</dd>
              </div>
              <div className="flex flex-wrap gap-1">
                <dt className="text-muted-foreground">{t("evidence")}</dt>
                <dd>{t("evidenceCount", { count: h.evidenceCount })}</dd>
              </div>
            </dl>
          </li>
        );
      })}
    </ul>
  );
}
