/**
 * Chronologie d'activité, la plus récente en haut, groupée par jour
 * (« Aujourd'hui », « Hier », « lundi 3 novembre »).
 *
 * Source : ZeroAds `packages/ui/src/patterns/activity-timeline.tsx` et
 * `apps/web/src/components/overview/activity-timeline.tsx` (code d'Olivier ; la géométrie
 * y avait été réécrite d'après l'étude de Twenty CRM, aucun code AGPL repris).
 * Adapté à Wema : pastille de 28 px teintée selon le sens, jour en étiquette Geist Mono,
 * heure en chiffres tabulaires, sans trait vertical à gauche. Rendu possible côté serveur.
 *
 * Props :
 * - `events` : `{ id, at (ISO), icon, tone?, title, detail? }[]`, dans n'importe quel ordre.
 * - `timeZone` : fuseau d'affichage (obligatoire : jamais celui du serveur par hasard).
 * - `now` : instant de référence pour « Aujourd'hui » / « Hier » (défaut : maintenant).
 * - `label` : nom accessible (« Activité de Awa »).
 * - `footer` : sous la liste (« Voir plus ancien »).
 * - `labels` : `today`, `yesterday`.
 * Fonction utile exportée : `groupEventsByDay`.
 */
import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export type TimelineTone =
  | "neutral"
  | "brand"
  | "success"
  | "warning"
  | "danger"
  | "info";

export interface TimelineEvent {
  readonly id: string;
  /** Instant ISO. */
  readonly at: string;
  /** Glyphe Phosphor, décoratif : la phrase porte le sens. */
  readonly icon: ReactNode;
  readonly tone?: TimelineTone | undefined;
  /** La phrase : « Awa a validé la notion Fractions ». */
  readonly title: ReactNode;
  /** Un extrait ou une seconde ligne. */
  readonly detail?: ReactNode;
}

export interface TimelineDay {
  readonly key: string;
  readonly label: string;
  readonly events: readonly TimelineEvent[];
}

const TONE: Record<TimelineTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  brand: "bg-brand-soft text-brand-text",
  success: "bg-success-soft text-success-text",
  warning: "bg-warning-soft text-warning-text",
  danger: "bg-danger-soft text-danger-text",
  info: "bg-info-soft text-info-text",
};

function dayKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Regroupe les événements par jour du fuseau, du plus récent au plus ancien. */
export function groupEventsByDay(
  events: readonly TimelineEvent[],
  options: {
    timeZone: string;
    now?: Date | undefined;
    today?: string | undefined;
    yesterday?: string | undefined;
  },
): TimelineDay[] {
  const now = options.now ?? new Date();
  const todayKey = dayKey(now, options.timeZone);
  const yesterdayKey = dayKey(
    new Date(now.getTime() - 86_400_000),
    options.timeZone,
  );
  const longDay = new Intl.DateTimeFormat("fr-FR", {
    timeZone: options.timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const sorted = [...events].sort(
    (a, b) => Date.parse(b.at) - Date.parse(a.at),
  );
  const days: { key: string; label: string; events: TimelineEvent[] }[] = [];
  for (const event of sorted) {
    const date = new Date(event.at);
    const key = dayKey(date, options.timeZone);
    let day = days.at(-1);
    if (day?.key !== key) {
      const label =
        key === todayKey
          ? (options.today ?? "Aujourd'hui")
          : key === yesterdayKey
            ? (options.yesterday ?? "Hier")
            : longDay.format(date);
      day = { key, label, events: [] };
      days.push(day);
    }
    day.events.push(event);
  }
  return days;
}

export interface ActivityTimelineProps {
  readonly events: readonly TimelineEvent[];
  readonly timeZone: string;
  readonly now?: Date | undefined;
  readonly label: string;
  readonly footer?: ReactNode;
  readonly labels?: {
    readonly today?: string | undefined;
    readonly yesterday?: string | undefined;
  };
  readonly className?: string | undefined;
}

export function ActivityTimeline({
  events,
  timeZone,
  now,
  label,
  footer,
  labels,
  className,
}: ActivityTimelineProps) {
  const days = groupEventsByDay(events, {
    timeZone,
    now,
    today: labels?.today,
    yesterday: labels?.yesterday,
  });
  const time = new Intl.DateTimeFormat("fr-FR", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <section
      aria-label={label}
      className={cn("grid gap-6", className)}
      data-slot="activity-timeline"
    >
      {days.map((day) => (
        <div key={day.key} className="grid gap-3">
          <h3 className="flex items-center gap-3 font-mono text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
            {day.label}
            <span aria-hidden className="h-px flex-1 bg-border" />
          </h3>
          <ol className="grid gap-3">
            {day.events.map((event) => (
              <li
                key={event.id}
                className="grid grid-cols-[28px_minmax(0,1fr)] gap-x-3"
              >
                <span
                  aria-hidden
                  className={cn(
                    "grid size-7 place-items-center rounded-chip [&_svg]:size-3.5",
                    TONE[event.tone ?? "neutral"],
                  )}
                >
                  {event.icon}
                </span>
                <div className="grid min-w-0 gap-0.5 pt-1">
                  <div className="flex min-w-0 items-baseline justify-between gap-3">
                    <p className="min-w-0 text-[13px] leading-snug text-foreground">
                      {event.title}
                    </p>
                    <time
                      dateTime={event.at}
                      className="shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums"
                    >
                      {time.format(new Date(event.at))}
                    </time>
                  </div>
                  {event.detail ? (
                    <div className="max-w-[420px] text-xs text-pretty text-muted-foreground">
                      {event.detail}
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </div>
      ))}
      {footer ? <div>{footer}</div> : null}
    </section>
  );
}
