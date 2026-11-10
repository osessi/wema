import {
  ArrowRight,
  ArrowsClockwise,
  Barbell,
  CalendarCheck,
  ChatCircleDots,
  CheckCircle,
  Clock,
  Flag,
  Lightbulb,
  PencilSimpleLine,
  Smiley,
  Stack,
  WarningCircle,
} from "@phosphor-icons/react/ssr";
import { GlowTile, type GlowTone } from "@wema/ui/components/brand/glow-tile";
import { TsfFrame } from "@wema/ui/components/brand/tsf-frame";
import { Button } from "@wema/ui/components/ui/button";
import {
  NOTION_STATUS_TONES,
  NotionStatus,
} from "@wema/ui/components/wema/notion-status";
import { StatTile } from "@wema/ui/components/wema/stat-tile";
import { cn } from "@wema/ui/lib/utils";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { ChildSummary, NextActionKind } from "../../lib/guardian-types";
import { WeeklySummary } from "./weekly-summary";

/** Pastille de chaque type de prochaine étape. */
const NEXT_ICON: Record<NextActionKind, { tone: GlowTone; icon: ReactNode }> = {
  assignment_due: { tone: "amber", icon: <CalendarCheck weight="bold" /> },
  easy_win: { tone: "mint", icon: <Smiley weight="bold" /> },
  finish_exercise: { tone: "yellow", icon: <PencilSimpleLine weight="bold" /> },
  intake: { tone: "sky", icon: <ChatCircleDots weight="bold" /> },
  misconception_focus: { tone: "rose", icon: <Lightbulb weight="bold" /> },
  practice: { tone: "yellow", icon: <Barbell weight="bold" /> },
  prerequisite_first: { tone: "slate", icon: <Stack weight="bold" /> },
  spaced_review: { tone: "sky", icon: <ArrowsClockwise weight="bold" /> },
  start_notion: { tone: "mint", icon: <Flag weight="bold" /> },
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");

/** Sous-titre de bloc, en Geist Mono majuscule. */
function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <h3 className="font-mono text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
      {children}
    </h3>
  );
}

/** Carte héro d'un enfant : qui il est, ses devoirs, ses notions et ses prochaines étapes. */
export function ChildCard({
  child,
  organizationName,
}: {
  child: ChildSummary;
  organizationName?: string | undefined;
}) {
  const t = useTranslations("guardian.home");
  const tNext = useTranslations("guardian.nextActions");
  const tWeek = useTranslations("guardian.week");
  const { notions, assignments } = child;
  const started = notions.mastered + notions.inProgress + notions.needsWork;
  const segments = [
    {
      status: "mastered",
      count: notions.mastered,
      label: t("mastered", { count: notions.mastered }),
    },
    {
      status: "in_progress",
      count: notions.inProgress,
      label: t("inProgress", { count: notions.inProgress }),
    },
    {
      status: "needs_work",
      count: notions.needsWork,
      label: t("needsWork", { count: notions.needsWork }),
    },
  ] as const;
  // Le parent voit le type d'étape : deux exercices à finir font une seule ligne.
  const kinds = [...new Set(child.nextActions.map((a) => a.kind))];
  const href = `/parent/enfants/${child.organizationId}/${child.learnerId}`;

  return (
    <TsfFrame innerClassName="flex flex-col gap-6 p-5 sm:p-6">
      <header className="flex flex-wrap items-center gap-4">
        <span
          aria-hidden
          className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand text-lg font-semibold text-ink-on-brand"
        >
          {initials(child.displayName)}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="truncate text-2xl font-light tracking-tight">
            {child.displayName}
          </h2>
          <p className="font-mono text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
            {[
              organizationName,
              started === 0
                ? t("notStartedShort")
                : t("started", { count: started }),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <Button asChild variant="brand" className="w-full sm:w-auto">
          <Link href={href}>
            {t("open")}
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      </header>

      <section className="flex flex-col gap-3">
        <Eyebrow>{tWeek("title")}</Eyebrow>
        <WeeklySummary child={child} />
      </section>

      <section className="flex flex-col gap-3">
        <Eyebrow>{t("assignmentsTitle")}</Eyebrow>
        <div className="grid grid-cols-3 gap-2 sm:gap-3 max-sm:[&_[data-slot=glow-tile]]:hidden max-sm:[&_[data-slot=stat-tile]]:p-3">
          <StatTile
            label={t("pending")}
            value={assignments.pending}
            icon={<Clock weight="bold" />}
            tone="amber"
          />
          <StatTile
            label={t("late")}
            value={assignments.late}
            icon={<WarningCircle weight="bold" />}
            tone={assignments.late > 0 ? "rose" : "slate"}
          />
          <StatTile
            label={t("done")}
            value={assignments.done}
            icon={<CheckCircle weight="bold" />}
            tone="mint"
          />
        </div>
        {assignments.late > 0 && (
          <p className="flex items-center gap-2 text-sm text-danger-text">
            <WarningCircle
              aria-hidden
              weight="bold"
              className="size-4 shrink-0"
            />
            {t("lateHint", { count: assignments.late })}
          </p>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="flex h-full flex-col gap-4 rounded-card border bg-card p-4">
          <Eyebrow>{t("notionsTitle")}</Eyebrow>
          {started === 0 ? (
            <p className="text-sm text-muted-foreground">{t("notStarted")}</p>
          ) : (
            <>
              <div
                aria-hidden
                className="flex h-3 w-full gap-1 overflow-hidden rounded-full"
              >
                {segments.map((s) =>
                  s.count > 0 ? (
                    <span
                      key={s.status}
                      className={cn(
                        "h-full rounded-full ring-1 ring-foreground/10 ring-inset",
                        NOTION_STATUS_TONES[s.status].cell,
                      )}
                      style={{ width: `${(s.count / started) * 100}%` }}
                    />
                  ) : null,
                )}
              </div>
              <ul className="flex flex-wrap gap-2">
                {segments.map((s) => (
                  <li key={s.status}>
                    <NotionStatus
                      status={s.status}
                      label={s.label}
                      className="tabular-nums"
                    />
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="flex h-full flex-col gap-4 rounded-card border bg-card p-4">
          <Eyebrow>{t("nextTitle")}</Eyebrow>
          {kinds.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("nextNone")}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {kinds.map((kind) => (
                <li key={kind} className="flex items-center gap-3 text-sm">
                  <GlowTile tone={NEXT_ICON[kind].tone} size={28} glyph="60%">
                    {NEXT_ICON[kind].icon}
                  </GlowTile>
                  <span>{tNext(kind)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </TsfFrame>
  );
}
