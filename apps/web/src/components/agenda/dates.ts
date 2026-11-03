/**
 * Dates des vues de l'agenda (repris du planning de Workbots). Tout est
 * calculé dans le fuseau du navigateur, c'est-à-dire celui de la personne qui
 * regarde : l'agenda ne s'affiche qu'une fois dans le navigateur.
 */

export type AgendaView = "week" | "month" | "year";

const pad = (n: number) => String(n).padStart(2, "0");

/** Date locale « AAAA-MM-JJ ». */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Heure locale « HH:MM ». */
export function clock(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Minuit local du jour. */
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** Jour de la semaine ISO : 1 = lundi … 7 = dimanche. */
export function isoWeekday(d: Date): number {
  return d.getDay() === 0 ? 7 : d.getDay();
}

/** Lundi de la semaine. */
export function startOfWeek(d: Date): Date {
  return addDays(startOfDay(d), -(isoWeekday(d) - 1));
}

export function weekDays(anchor: Date): Date[] {
  const monday = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** Les 42 cases de la grille mensuelle (6 semaines pleines). */
export function monthGrid(anchor: Date): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

/** Période chargée pour une vue (la vue mois déborde sur ses semaines voisines). */
export function viewRange(
  view: AgendaView,
  anchor: Date,
): { from: Date; to: Date } {
  if (view === "week") {
    const from = startOfWeek(anchor);
    return { from, to: addDays(from, 7) };
  }
  if (view === "month") {
    const grid = monthGrid(anchor);
    const first = grid[0] ?? startOfDay(anchor);
    return { from: first, to: addDays(first, 42) };
  }
  return {
    from: new Date(anchor.getFullYear(), 0, 1),
    to: new Date(anchor.getFullYear() + 1, 0, 1),
  };
}

/** Décale l'ancre d'un pas de vue (+1 / -1). */
export function shiftAnchor(
  view: AgendaView,
  anchor: Date,
  step: number,
): Date {
  if (view === "week") return addDays(anchor, 7 * step);
  if (view === "month")
    return new Date(anchor.getFullYear(), anchor.getMonth() + step, 1);
  return new Date(anchor.getFullYear() + step, 0, 1);
}

/** Minutes depuis minuit local. */
export function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/** Instant local d'un jour et d'une heure « HH:MM ». */
export function atClock(day: string, time: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  const t = /^(\d{2}):(\d{2})$/.exec(time);
  if (!m || !t) return null;
  return new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(t[1]),
    Number(t[2]),
  );
}

/** Fuseau du navigateur. */
export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** Minutes depuis minuit vers « HH:MM ». */
export function formatClock(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}
