import {
  ChalkboardTeacher,
  ChartBar,
  Check,
  Handshake,
  Question,
  Robot,
  Student,
  UserCircle,
  X,
} from "@phosphor-icons/react/ssr";
import { Badge } from "@wema/ui/components/ui/badge";
import { Progress } from "@wema/ui/components/ui/progress";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import { cn } from "@wema/ui/lib/utils";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { ProfileHypothesis } from "../../lib/guardian-types";
import { hypothesisBadge, shownStatus } from "../../lib/hypothesis";

type Source = ProfileHypothesis["sources"][number];

const SOURCE_ICON: Record<Source, ReactNode> = {
  declared_guardian: <UserCircle aria-hidden weight="bold" />,
  declared_learner: <Student aria-hidden weight="bold" />,
  declared_teacher: <ChalkboardTeacher aria-hidden weight="bold" />,
  intake: <Robot aria-hidden weight="bold" />,
  diagnostic: <Handshake aria-hidden weight="bold" />,
  measured: <ChartBar aria-hidden weight="bold" />,
};

const STATUS_ICON = {
  supported: <Check aria-hidden weight="bold" />,
  uncertain: <Question aria-hidden weight="bold" />,
  contradicted: <X aria-hidden weight="bold" />,
} as const;

/** Couleur de la jauge, selon le statut affiché. */
const GAUGE = {
  supported: "from-success-text/40 to-success-text",
  uncertain: "from-muted-foreground/30 to-muted-foreground/70",
  contradicted: "from-danger-text/40 to-danger-text",
} as const;

/** Hypothèses sur la façon d'apprendre : chacune avec sa source, sa confiance et ses preuves. */
export function HypothesesList({
  hypotheses,
}: {
  hypotheses: ProfileHypothesis[];
}) {
  const t = useTranslations("guardian.profile");
  if (hypotheses.length === 0)
    return (
      <EmptyState
        variant="inline"
        icon={<Question weight="bold" />}
        tone="sky"
        title={t("noHypotheses")}
        titleAs="p"
      />
    );
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {hypotheses.map((h) => {
        const confidence = Math.round(h.confidence * 100);
        const status = shownStatus(h);
        return (
          <li
            key={h.key}
            className="flex h-full flex-col gap-4 rounded-card border bg-background/60 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium leading-snug">{h.statement}</p>
              <Badge variant={hypothesisBadge[status]}>
                {STATUS_ICON[status]}
                {t(`hypothesisStatus.${status}`)}
              </Badge>
            </div>
            <div className="mt-auto flex flex-col gap-1.5">
              <div className="flex items-center justify-between font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
                <span id={`conf-${h.key}`}>{t("confidence")}</span>
                <span className="tabular-nums">{confidence} %</span>
              </div>
              <Progress
                value={confidence}
                aria-labelledby={`conf-${h.key}`}
                indicatorClassName={cn("bg-gradient-to-r", GAUGE[status])}
              />
            </div>
            <dl className="flex flex-wrap items-center gap-2 text-xs">
              <dt className="sr-only">{t("sources")}</dt>
              {h.sources.map((s) => (
                <dd
                  key={s}
                  className="inline-flex items-center gap-1 rounded-chip border bg-card px-2 py-0.5 font-mono text-[11px] text-muted-foreground [&>svg]:size-3"
                >
                  {SOURCE_ICON[s]}
                  {t(`source.${s}`)}
                </dd>
              ))}
              <dt className="sr-only">{t("evidence")}</dt>
              <dd className="inline-flex items-center rounded-chip bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground tabular-nums">
                {t("evidenceCount", { count: h.evidenceCount })}
              </dd>
            </dl>
          </li>
        );
      })}
    </ul>
  );
}
