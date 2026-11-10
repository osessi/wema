"use client";

import { CalendarCheck, UsersThree, VideoCamera } from "@phosphor-icons/react";
import { cn } from "@wema/ui/lib/utils";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  addDays,
  clock,
  dayKey,
  isoWeekday,
  minutesOfDay,
  monthGrid,
  startOfDay,
  weekDays,
} from "./dates";
import type { SessionStatus } from "./types";
import { sessionTone } from "./use-agenda";

/** Élément affiché dans l'agenda : une séance ou l'échéance d'un devoir. */
export interface AgendaEvent {
  id: string;
  type: "session" | "assignment";
  start: Date;
  end: Date;
  label: string;
  href: string | null;
  status: SessionStatus | null;
  group: boolean;
  done: boolean;
}

export interface AgendaWindow {
  start: Date;
  end: Date;
}

const HOUR_HEIGHT = 56;

function EventChip({
  event,
  compact,
  style,
  className,
}: {
  event: AgendaEvent;
  compact?: boolean;
  style?: React.CSSProperties;
  className?: string;
}) {
  const tone =
    event.type === "assignment"
      ? cn(
          "border border-transparent bg-accent text-accent-foreground",
          event.done && "opacity-60",
        )
      : sessionTone(event.status ?? "confirmed");
  const Icon =
    event.type === "assignment"
      ? CalendarCheck
      : event.group
        ? UsersThree
        : VideoCamera;
  const body = (
    <>
      <span className="flex items-center gap-1 font-medium tabular-nums">
        <Icon aria-hidden className="size-3 shrink-0" />
        {clock(event.start)}
        {!compact && event.type === "session" && ` – ${clock(event.end)}`}
      </span>
      <span className="truncate">{event.label}</span>
    </>
  );
  const classes = cn(
    "flex min-w-0 overflow-hidden rounded-md px-1.5 py-1 text-left text-[11px] leading-tight transition-colors",
    compact ? "items-center gap-1" : "flex-col gap-0.5",
    tone,
    event.href &&
      "hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring",
    className,
  );
  return event.href ? (
    <Link href={event.href} className={classes} style={style}>
      {body}
    </Link>
  ) : (
    <div className={classes} style={style}>
      {body}
    </div>
  );
}

/** Répartit les séances d'un jour en colonnes quand elles se chevauchent. */
function lanes(events: AgendaEvent[]) {
  const sorted = [...events].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );
  const ends: number[] = [];
  const placed = sorted.map((e) => {
    let lane = ends.findIndex((end) => end <= e.start.getTime());
    if (lane === -1) {
      lane = ends.length;
      ends.push(e.end.getTime());
    } else ends[lane] = e.end.getTime();
    return { event: e, lane };
  });
  return { placed, count: Math.max(1, ends.length) };
}

/** Vue semaine : une colonne par jour, une ligne par heure. */
export function WeekView({
  anchor,
  events,
  windows,
  onCreate,
}: {
  anchor: Date;
  events: AgendaEvent[];
  windows: AgendaWindow[];
  /** Espace prof : cliquer sur une case vide planifie une séance. */
  onCreate?: ((day: string, time: string) => void) | undefined;
}) {
  const t = useTranslations("agenda");
  const days = weekDays(anchor);
  const short: string[] = t.raw("weekdaysShort");
  const todayKey = dayKey(new Date());
  const timed = events.filter((e) => e.type === "session");
  const allDay = events.filter((e) => e.type === "assignment");

  // Plage horaire : 8 h – 20 h, élargie aux séances et disponibilités de la semaine.
  let first = 8;
  let last = 20;
  for (const e of [...timed, ...windows]) {
    first = Math.min(first, e.start.getHours());
    last = Math.max(
      last,
      dayKey(e.end) === dayKey(e.start)
        ? Math.ceil(minutesOfDay(e.end) / 60)
        : 24,
    );
  }
  const hours = Array.from({ length: last - first }, (_, i) => first + i);
  const gridHeight = hours.length * HOUR_HEIGHT;
  const position = (start: Date, end: Date, day: Date) => {
    const dayStart = startOfDay(day).getTime();
    const from = Math.max(start.getTime(), dayStart + first * 3_600_000);
    const to = Math.min(end.getTime(), dayStart + last * 3_600_000);
    const top = ((from - dayStart) / 3_600_000 - first) * HOUR_HEIGHT;
    const height = Math.max(((to - from) / 3_600_000) * HOUR_HEIGHT, 22);
    return { top: Math.max(0, Math.min(top, gridHeight - height)), height };
  };

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b bg-muted/40">
            <div />
            {days.map((d, i) => {
              const key = dayKey(d);
              const due = allDay.filter((e) => dayKey(e.start) === key);
              return (
                <div
                  key={key}
                  className="min-w-0 space-y-1 px-1.5 py-2 text-center"
                >
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {short[i]}
                  </p>
                  <p
                    className={cn(
                      "mx-auto flex size-7 items-center justify-center rounded-full text-sm font-semibold",
                      key === todayKey && "bg-primary text-primary-foreground",
                    )}
                  >
                    {d.getDate()}
                  </p>
                  {due.map((e) => (
                    <EventChip key={e.id} event={e} compact />
                  ))}
                </div>
              );
            })}
          </div>

          <div className="relative grid grid-cols-[56px_repeat(7,1fr)]">
            <div>
              {hours.map((h) => (
                <div
                  key={h}
                  style={{ height: HOUR_HEIGHT }}
                  className="pr-2 text-right text-[11px] tabular-nums text-muted-foreground"
                >
                  {String(h).padStart(2, "0")}:00
                </div>
              ))}
            </div>
            {days.map((d) => {
              const key = dayKey(d);
              const dayEnd = addDays(d, 1).getTime();
              const inDay = <T extends { start: Date; end: Date }>(x: T) =>
                x.start.getTime() < dayEnd && x.end.getTime() > d.getTime();
              const { placed, count } = lanes(timed.filter(inDay));
              return (
                <div key={key} className="relative border-l">
                  {windows.filter(inDay).map((w) => {
                    const { top, height } = position(w.start, w.end, d);
                    return (
                      <div
                        key={`${w.start.toISOString()}`}
                        aria-hidden
                        style={{ top, height }}
                        className="pointer-events-none absolute inset-x-0 bg-secondary/70"
                      />
                    );
                  })}
                  {hours.map((h) => {
                    const time = `${String(h).padStart(2, "0")}:00`;
                    return onCreate ? (
                      <button
                        key={h}
                        type="button"
                        onClick={() => onCreate(key, time)}
                        style={{ height: HOUR_HEIGHT }}
                        className="relative block w-full border-t border-border/60 transition-colors hover:bg-accent/40"
                        aria-label={t("addAt", {
                          date: d.toLocaleDateString("fr-FR"),
                          time,
                        })}
                      />
                    ) : (
                      <div
                        key={h}
                        style={{ height: HOUR_HEIGHT }}
                        className="border-t border-border/60"
                      />
                    );
                  })}
                  {placed.map(({ event, lane }) => {
                    const { top, height } = position(event.start, event.end, d);
                    return (
                      <EventChip
                        key={event.id}
                        event={event}
                        compact={height < 40}
                        className="absolute z-10"
                        style={{
                          top,
                          height,
                          left: `calc(${(lane / count) * 100}% + 2px)`,
                          width: `calc(${100 / count}% - 4px)`,
                        }}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Vue mois : six semaines, chaque jour liste ses éléments. */
export function MonthView({
  anchor,
  events,
  windows,
  onOpenDay,
}: {
  anchor: Date;
  events: AgendaEvent[];
  windows: AgendaWindow[];
  onOpenDay: (day: Date) => void;
}) {
  const t = useTranslations("agenda");
  const short: string[] = t.raw("weekdaysShort");
  const cells = monthGrid(anchor);
  const month = anchor.getMonth();
  const todayKey = dayKey(new Date());
  const byDay = new Map<string, AgendaEvent[]>();
  for (const e of events)
    byDay.set(dayKey(e.start), [...(byDay.get(dayKey(e.start)) ?? []), e]);
  const freeDays = new Set(windows.map((w) => dayKey(w.start)));

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="grid grid-cols-7 border-b bg-muted/40">
        {short.map((name) => (
          <div
            key={name}
            className="px-1 py-2 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
          >
            {name}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d) => {
          const key = dayKey(d);
          const list = (byDay.get(key) ?? []).sort(
            (a, b) => a.start.getTime() - b.start.getTime(),
          );
          return (
            <div
              key={key}
              className={cn(
                "min-h-24 min-w-0 border-t border-l p-1 first:border-l-0 sm:min-h-28",
                isoWeekday(d) === 1 && "border-l-0",
                d.getMonth() !== month && "bg-muted/30 text-muted-foreground",
              )}
            >
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => onOpenDay(d)}
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-xs font-semibold hover:bg-secondary",
                    key === todayKey &&
                      "bg-primary text-primary-foreground hover:bg-primary",
                  )}
                  aria-label={d.toLocaleDateString("fr-FR")}
                >
                  {d.getDate()}
                </button>
                {freeDays.has(key) && (
                  <span
                    className="hidden text-[10px] text-muted-foreground sm:inline"
                    title={t("available")}
                  >
                    {t("available")}
                  </span>
                )}
              </div>
              <div className="mt-1 space-y-1">
                {list.slice(0, 3).map((e) => (
                  <EventChip key={e.id} event={e} compact />
                ))}
                {list.length > 3 && (
                  <button
                    type="button"
                    onClick={() => onOpenDay(d)}
                    className="pl-1 text-[10px] text-muted-foreground hover:underline"
                  >
                    {t("more", { count: list.length - 3 })}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Vue année : douze mois miniatures, la teinte donne la charge de chaque jour. */
export function YearView({
  anchor,
  events,
  onOpenDay,
}: {
  anchor: Date;
  events: AgendaEvent[];
  onOpenDay: (day: Date) => void;
}) {
  const t = useTranslations("agenda");
  const letters: string[] = t.raw("weekdaysLetter");
  const year = anchor.getFullYear();
  const todayKey = dayKey(new Date());
  const count = new Map<string, number>();
  for (const e of events)
    count.set(dayKey(e.start), (count.get(dayKey(e.start)) ?? 0) + 1);
  const shade = (n: number) =>
    n === 0
      ? "text-muted-foreground hover:bg-secondary"
      : n === 1
        ? "bg-secondary text-foreground"
        : n <= 3
          ? "bg-primary/25 text-foreground"
          : "bg-primary text-primary-foreground";

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 12 }, (_, m) => {
        const firstDay = new Date(year, m, 1);
        const days = new Date(year, m + 1, 0).getDate();
        return (
          <div
            key={firstDay.getTime()}
            className="rounded-xl border bg-card p-3"
          >
            <p className="mb-2 text-sm font-semibold capitalize">
              {firstDay.toLocaleDateString("fr-FR", { month: "long" })}
            </p>
            <div className="grid grid-cols-7 gap-0.5">
              {letters.map((l, i) => (
                <span
                  // biome-ignore lint/suspicious/noArrayIndexKey: lettres répétées (M, M)
                  key={i}
                  className="text-center text-[9px] font-medium uppercase text-muted-foreground"
                >
                  {l}
                </span>
              ))}
              {Array.from({ length: days }, (_, i) => {
                const d = new Date(year, m, i + 1);
                const key = dayKey(d);
                const n = count.get(key) ?? 0;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onOpenDay(d)}
                    style={
                      i === 0
                        ? { gridColumnStart: isoWeekday(firstDay) }
                        : undefined
                    }
                    title={`${d.toLocaleDateString("fr-FR")} · ${t("dayCount", { count: n })}`}
                    className={cn(
                      "flex h-6 items-center justify-center rounded text-[10px] font-medium tabular-nums",
                      shade(n),
                      key === todayKey && "ring-2 ring-ring",
                    )}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
