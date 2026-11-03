import { ArrowRight } from "@phosphor-icons/react/ssr";
import { Button } from "@wema/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@wema/ui/components/ui/card";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ChildSummary } from "../../lib/guardian-types";
import { StatusChip } from "./status-chip";

function Count({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-lg border bg-background px-3 py-2">
      <div className="font-display text-2xl font-bold tabular-nums">
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

/** Carte d'un enfant : où il en est, ses devoirs et ses prochaines étapes. */
export function ChildCard({ child }: { child: ChildSummary }) {
  const t = useTranslations("guardian.home");
  const tNext = useTranslations("guardian.nextActions");
  const { notions, assignments } = child;
  const started = notions.mastered + notions.inProgress + notions.needsWork;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-xl">
          {child.displayName}
        </CardTitle>
        <CardDescription>
          {started === 0 ? t("notStarted") : t("started", { count: started })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <section className="space-y-2">
          <h3 className="text-sm font-medium">{t("notionsTitle")}</h3>
          <div className="flex flex-wrap gap-2">
            <StatusChip status="mastered">
              {t("mastered", { count: notions.mastered })}
            </StatusChip>
            <StatusChip status="in_progress">
              {t("inProgress", { count: notions.inProgress })}
            </StatusChip>
            <StatusChip status="needs_work">
              {t("needsWork", { count: notions.needsWork })}
            </StatusChip>
          </div>
        </section>
        <section className="space-y-2">
          <h3 className="text-sm font-medium">{t("assignmentsTitle")}</h3>
          <div className="grid grid-cols-3 gap-2">
            <Count value={assignments.pending} label={t("pending")} />
            <Count value={assignments.late} label={t("late")} />
            <Count value={assignments.done} label={t("done")} />
          </div>
          {assignments.late > 0 && (
            <p className="text-sm text-muted-foreground">
              {t("lateHint", { count: assignments.late })}
            </p>
          )}
        </section>
        <section className="space-y-2">
          <h3 className="text-sm font-medium">{t("nextTitle")}</h3>
          {child.nextActions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("nextNone")}</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {child.nextActions.map((a) => (
                <li key={a.kind} className="flex gap-2">
                  <ArrowRight
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <span>{tNext(a.kind)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </CardContent>
      <CardFooter>
        <Button asChild variant="outline">
          <Link
            href={`/parent/enfants/${child.organizationId}/${child.learnerId}`}
          >
            {t("open")}
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
