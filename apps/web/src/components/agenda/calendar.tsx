"use client";

import { ArrowClockwise, WarningCircle } from "@phosphor-icons/react";
import { Button } from "@wema/ui/components/ui/button";
import { Skeleton } from "@wema/ui/components/ui/skeleton";
import {
  Agenda,
  type AgendaEvent,
  type AgendaTone,
  type AgendaView,
  addDaysKey,
  dayKeyIn,
  zonedInstant,
} from "@wema/ui/components/wema/agenda";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { browserTimeZone } from "./dates";
import {
  type AgendaSpace,
  type CalendarData,
  type CalendarSession,
  type SessionStatus,
  sessionHref,
} from "./types";
import { useMounted, useSessionLabel } from "./use-agenda";

const VIEW_KEY = "wema.agenda.view";

function readView(): AgendaView {
  try {
    return window.localStorage.getItem(VIEW_KEY) === "month" ? "month" : "week";
  } catch {
    return "week";
  }
}

/** Jour ISO (1 = lundi … 7 = dimanche) d'une clé « AAAA-MM-JJ ». */
function isoWeekday(key: string): number {
  const d = new Date(`${key}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

/** Période chargée : la semaine, ou les six semaines de la grille du mois. */
function range(view: AgendaView, anchor: Date, timeZone: string) {
  const key = dayKeyIn(anchor, timeZone);
  const first = view === "week" ? key : `${key.slice(0, 8)}01`;
  const monday = addDaysKey(first, 1 - isoWeekday(first));
  const days = view === "week" ? 7 : 42;
  return {
    from: zonedInstant(monday, 0, timeZone),
    to: zonedInstant(addDaysKey(monday, days), 0, timeZone),
  };
}

/** Couleur d'une séance : jaune (individuelle), menthe (groupe), beurre (en attente), sable (passée ou annulée). */
function sessionTone(status: SessionStatus, group: boolean): AgendaTone {
  if (status === "requested" || status === "proposed") return "butter";
  if (status === "done" || status === "cancelled" || status === "declined")
    return "sand";
  return group ? "mint" : "brand";
}

/**
 * Agenda semaine et mois (composant `Agenda` partagé), dans le fuseau du
 * navigateur. Les données sont relues à chaque changement de période, et quand
 * `stamp` change (la page serveur a été rafraîchie après une écriture).
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
    <Skeleton className="h-[560px] w-full rounded-card" />
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
  const [timeZone] = useState(browserTimeZone);
  const [view, setView] = useState<AgendaView>(readView);
  const [anchor, setAnchor] = useState(() => new Date());
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

  const { from, to } = range(view, anchor, timeZone);
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

  if (failed)
    return (
      <EmptyState
        icon={<WarningCircle weight="bold" />}
        tone="rose"
        titleAs="h2"
        title={t("loadError")}
        action={
          <Button variant="outline" onClick={() => setAttempt((n) => n + 1)}>
            <ArrowClockwise aria-hidden />
            {t("retry")}
          </Button>
        }
      />
    );
  if (!data) return <Skeleton className="h-[560px] w-full rounded-card" />;

  const sessions: CalendarSession[] = data.sessions;
  const now = Date.now();
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
      tone: sessionTone(s.status, s.kind === "group"),
    })),
    ...data.assignments.map((a) => {
      const due = new Date(a.dueAt);
      const tone: AgendaTone = a.done
        ? "lime"
        : due.getTime() < now
          ? "peach"
          : "rose";
      return {
        id: `devoir-${a.id}`,
        type: "assignment" as const,
        start: due,
        end: due,
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
        tone,
      };
    }),
  ];
  const windows = data.availability.map((w) => ({
    start: new Date(w.start),
    end: new Date(w.end),
  }));

  return (
    <Agenda
      view={view}
      onViewChange={choose}
      anchor={anchor}
      onAnchorChange={setAnchor}
      events={events}
      windows={windows}
      timeZone={timeZone}
      onCreate={onCreate}
      onOpenDay={(day) => {
        setAnchor(zonedInstant(day, 12 * 60, timeZone));
        choose("week");
      }}
      renderLink={({ href, children, ...props }) => (
        <Link href={href} {...props}>
          {children}
        </Link>
      )}
      labels={{
        today: t("today"),
        previous: t("nav_prev"),
        next: t("nav_next"),
        view: t("viewLabel"),
        week: t("views.week"),
        month: t("views.month"),
        available: t("available"),
        dueRow: t("dueRow"),
        assignment: t("assignment"),
        addAt: t.raw("addAt"),
        more: (count) => t("more", { count }),
        timeZone: t.raw("timeZone"),
        moved: t.raw("moved"),
        status: {
          requested: t("status.requested"),
          proposed: t("status.proposed"),
          confirmed: t("status.confirmed"),
          declined: t("status.declined"),
          cancelled: t("status.cancelled"),
          done: t("status.done"),
        },
      }}
    />
  );
}
