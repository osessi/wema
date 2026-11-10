"use client";

import { Calendar } from "@wema/ui/components/ui/calendar";
import { toast } from "@wema/ui/components/ui/sonner";
import {
  Agenda,
  type AgendaEvent,
  type AgendaView,
} from "@wema/ui/components/wema/agenda";
import { useEffect, useState } from "react";
import type { DateRange } from "react-day-picker";
import { fr } from "react-day-picker/locale";
import { Section, Specimen } from "../_components/section";
import type { SectionProps } from "../_components/showcase";

const TZ = "Africa/Porto-Novo";
const ANCHOR = new Date("2026-11-10T12:00:00Z");

/** Séance ou devoir, le jour `day` (0 = lundi 9 novembre) à `h` heures UTC+1. */
function event(
  id: string,
  label: string,
  day: number,
  h: number,
  minutes: number,
  extra: Partial<AgendaEvent> = {},
): AgendaEvent {
  const start = new Date(Date.UTC(2026, 10, 9 + day, h - 1, 0));
  return {
    id,
    type: "session",
    label,
    start,
    end: new Date(start.getTime() + minutes * 60_000),
    href: null,
    status: "confirmed",
    group: false,
    done: false,
    movable: true,
    ...extra,
  };
}

const EVENTS: AgendaEvent[] = [
  event("s1", "Awa · Fractions", 0, 17, 45),
  event("s2", "4e B · Révisions", 1, 10, 90, { group: true, tone: "mint" }),
  event("s3", "Kofi · Pythagore", 1, 16, 45, {
    status: "proposed",
    tone: "ink",
  }),
  event("d1", "Devoir : équations", 2, 18, 30, {
    type: "assignment",
    tone: "butter",
    movable: false,
  }),
  event("s4", "Inès · Bilan", 3, 14, 60, { tone: "peach" }),
  event("s5", "Conseiller · Entretien", 3, 17, 15, { tone: "lime" }),
  event("s6", "Yao · Relatifs", 4, 9, 45, {
    status: "requested",
    tone: "rose",
  }),
  event("d2", "Devoir : proportions", 4, 18, 30, {
    type: "assignment",
    tone: "butter",
    movable: false,
  }),
  event("s7", "Atelier du samedi", 5, 10, 120, { group: true, tone: "sand" }),
  event("s8", "Awa · Pythagore", 8, 17, 45),
  event("s9", "4e B · Contrôle blanc", 10, 10, 60, {
    group: true,
    tone: "mint",
  }),
  event("s10", "Fatou · Fractions", 15, 16, 45, { tone: "peach" }),
];

function AgendaDemo({ initial }: { initial: AgendaView }) {
  const [view, setView] = useState<AgendaView>(initial);
  const [anchor, setAnchor] = useState(ANCHOR);
  const [events, setEvents] = useState(EVENTS);
  return (
    <Agenda
      view={view}
      onViewChange={setView}
      anchor={anchor}
      onAnchorChange={setAnchor}
      timeZone={TZ}
      events={events}
      windows={[0, 1, 2, 3, 4].map((d) => ({
        start: new Date(Date.UTC(2026, 10, 9 + d, 15, 0)),
        end: new Date(Date.UTC(2026, 10, 9 + d, 18, 0)),
      }))}
      dayStartHour={8}
      dayEndHour={20}
      onMove={(e, start, end) =>
        setEvents((list) =>
          list.map((x) => (x.id === e.id ? { ...x, start, end } : x)),
        )
      }
      onCreate={(day, time) =>
        toast(`Nouvelle séance le ${day} à ${time} (démo).`)
      }
      onEventSelect={(e) => toast(e.label)}
    />
  );
}

export function CalendarSection({ id, index, title }: SectionProps) {
  const [day, setDay] = useState<Date | undefined>(ANCHOR);
  // ui/calendar écrit `data-day` avec la langue du système : serveur et
  // navigateur peuvent différer. Rendu après l'hydratation.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [range, setRange] = useState<DateRange | undefined>({
    from: new Date("2026-11-16T12:00:00Z"),
    to: new Date("2026-11-20T12:00:00Z"),
  });
  return (
    <Section
      id={id}
      index={index}
      title={title}
      when="L'Agenda pour les séances et les échéances : la semaine pour planifier (glisser une séance la déplace par pas de 15 min), le mois pour voir loin. Le mini-calendrier pour choisir une date dans un formulaire."
    >
      <Specimen
        label="Agenda · vue semaine"
        note="Glissez une séance, cliquez un créneau libre"
      >
        <AgendaDemo initial="week" />
      </Specimen>
      <Specimen label="Agenda · vue mois">
        <AgendaDemo initial="month" />
      </Specimen>
      <div className="grid gap-8 md:grid-cols-2">
        <Specimen
          label="Mini-calendrier · une date"
          className="flex justify-center"
        >
          {mounted ? (
            <Calendar
              mode="single"
              locale={fr}
              selected={day}
              onSelect={setDay}
              defaultMonth={ANCHOR}
            />
          ) : null}
        </Specimen>
        <Specimen
          label="Mini-calendrier · une période"
          className="flex justify-center"
        >
          {mounted ? (
            <Calendar
              mode="range"
              locale={fr}
              selected={range}
              onSelect={setRange}
              defaultMonth={ANCHOR}
            />
          ) : null}
        </Specimen>
      </div>
    </Section>
  );
}
