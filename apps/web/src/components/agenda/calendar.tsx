"use client";

import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { Button } from "@wema/ui/components/ui/button";
import { Skeleton } from "@wema/ui/components/ui/skeleton";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@wema/ui/components/ui/toggle-group";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import {
  type AgendaView,
  addDays,
  browserTimeZone,
  shiftAnchor,
  startOfDay,
  startOfWeek,
  viewRange,
} from "./dates";
import {
  type AgendaSpace,
  type CalendarData,
  type CalendarSession,
  sessionHref,
} from "./types";
import { useMounted, useSessionLabel } from "./use-agenda";
import { type AgendaEvent, MonthView, WeekView, YearView } from "./views";

const VIEW_KEY = "wema.agenda.view";

function readView(): AgendaView {
  try {
    const v = window.localStorage.getItem(VIEW_KEY);
    return v === "month" || v === "year" ? v : "week";
  } catch {
    return "week";
  }
}

/** Titre de la période affichée. */
function periodLabel(view: AgendaView, anchor: Date): string {
  if (view === "week") {
    const monday = startOfWeek(anchor);
    const sunday = addDays(monday, 6);
    const sameMonth = monday.getMonth() === sunday.getMonth();
    const from = monday.toLocaleDateString("fr-FR", {
      day: "numeric",
      ...(sameMonth ? {} : { month: "long" }),
    });
    const to = sunday.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return `${from} – ${to}`;
  }
  if (view === "month")
    return anchor.toLocaleDateString("fr-FR", {
      month: "long",
      year: "numeric",
    });
  return String(anchor.getFullYear());
}

/**
 * Agenda en vues semaine, mois et année (d'après le planning de Workbots). Les
 * données sont relues à chaque changement de période, et quand `stamp` change
 * (la page serveur a été rafraîchie après une écriture).
 */
export function AgendaCalendar({
  space,
  stamp,
  onCreate,
}: {
  space: AgendaSpace;
  stamp: number;
  onCreate?: ((day: string, time: string) => void) | undefined;
}) {
  const mounted = useMounted();
  return mounted ? (
    <Calendar space={space} stamp={stamp} onCreate={onCreate} />
  ) : (
    <Skeleton className="h-[480px] w-full rounded-xl" />
  );
}

function Calendar({
  space,
  stamp,
  onCreate,
}: {
  space: AgendaSpace;
  stamp: number;
  onCreate?: ((day: string, time: string) => void) | undefined;
}) {
  const t = useTranslations("agenda");
  const label = useSessionLabel();
  const [view, setView] = useState<AgendaView>(readView);
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [data, setData] = useState<CalendarData | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const choose = (v: AgendaView) => {
    setView(v);
    try {
      window.localStorage.setItem(VIEW_KEY, v);
    } catch {
      // Stockage indisponible (navigation privée) : la vue n'est pas retenue.
    }
  };

  const { from, to } = viewRange(view, anchor);
  const fromIso = from.toISOString();
  const toIso = to.toISOString();

  const fetchRange = useCallback(
    async (signal: AbortSignal) => {
      const params = new URLSearchParams({ space, from: fromIso, to: toIso });
      const res = await fetch(`/api/agenda/calendar?${params}`, {
        credentials: "same-origin",
        signal,
      });
      if (!res.ok) throw new Error(`agenda ${res.status}`);
      const body: CalendarData = await res.json();
      return body;
    },
    [space, fromIso, toIso],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: `stamp` et `attempt` déclenchent une relecture
  useEffect(() => {
    const controller = new AbortController();
    setFailed(false);
    fetchRange(controller.signal)
      .then(setData)
      .catch((e: unknown) => {
        if (!(e instanceof DOMException && e.name === "AbortError"))
          setFailed(true);
      });
    return () => controller.abort();
  }, [fetchRange, stamp, attempt]);

  const sessions: CalendarSession[] = data?.sessions ?? [];
  const events: AgendaEvent[] = [
    ...sessions.map((s) => ({
      id: s.id,
      type: "session" as const,
      start: new Date(s.startsAt),
      end: new Date(s.endsAt),
      label:
        space === "guardian" && s.childNames && s.childNames.length > 0
          ? `${label(s, space)} · ${s.childNames.join(", ")}`
          : label(s, space),
      href: sessionHref(space, s.id),
      status: s.status,
      group: s.kind === "group",
      done: false,
    })),
    ...(data?.assignments ?? []).map((a) => ({
      id: `devoir-${a.id}`,
      type: "assignment" as const,
      start: new Date(a.dueAt),
      end: new Date(a.dueAt),
      label: a.learnerName
        ? t(a.done ? "doneItemFor" : "dueFor", {
            name: a.learnerName,
            title: a.title,
          })
        : t(a.done ? "doneItem" : "due", { title: a.title }),
      href: space === "learner" ? "/eleve/devoirs" : null,
      status: null,
      group: false,
      done: a.done,
    })),
  ];
  const windows = (data?.availability ?? []).map((w) => ({
    start: new Date(w.start),
    end: new Date(w.end),
  }));
  const openDay = (d: Date) => {
    setAnchor(startOfDay(d));
    choose("week");
  };

  return (
    <section className="space-y-3" aria-label={t("title")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setAnchor(shiftAnchor(view, anchor, -1))}
            aria-label={t("nav_prev")}
          >
            <CaretLeft aria-hidden />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setAnchor(shiftAnchor(view, anchor, 1))}
            aria-label={t("nav_next")}
          >
            <CaretRight aria-hidden />
          </Button>
          <Button
            variant="ghost"
            onClick={() => setAnchor(startOfDay(new Date()))}
          >
            {t("today")}
          </Button>
          <h2 className="ml-1 font-display text-lg font-semibold first-letter:uppercase">
            {periodLabel(view, anchor)}
          </h2>
        </div>
        <ToggleGroup
          type="single"
          variant="outline"
          value={view}
          onValueChange={(v) => {
            if (v === "week" || v === "month" || v === "year") choose(v);
          }}
        >
          <ToggleGroupItem value="week">{t("views.week")}</ToggleGroupItem>
          <ToggleGroupItem value="month">{t("views.month")}</ToggleGroupItem>
          <ToggleGroupItem value="year">{t("views.year")}</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {failed ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4 text-sm">
          <p role="alert">{t("loadError")}</p>
          <Button variant="outline" onClick={() => setAttempt((n) => n + 1)}>
            {t("retry")}
          </Button>
        </div>
      ) : !data ? (
        <Skeleton className="h-[480px] w-full rounded-xl" />
      ) : view === "week" ? (
        <WeekView
          anchor={anchor}
          events={events}
          windows={windows}
          onCreate={onCreate}
        />
      ) : view === "month" ? (
        <MonthView
          anchor={anchor}
          events={events}
          windows={windows}
          onOpenDay={openDay}
        />
      ) : (
        <YearView anchor={anchor} events={events} onOpenDay={openDay} />
      )}
      <p className="text-xs text-muted-foreground">
        {t("timeZone", { zone: browserTimeZone() })}
      </p>
    </section>
  );
}
