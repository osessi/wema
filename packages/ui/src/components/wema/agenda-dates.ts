/**
 * Calendrier dans un fuseau donné, sans dépendance. Les jours sont des clés
 * « AAAA-MM-JJ » du fuseau : l'arithmétique sur les jours se fait en UTC
 * (aucun changement d'heure), et seuls les passages instant ↔ heure murale
 * consultent le fuseau.
 */

const pad = (n: number) => String(n).padStart(2, "0");

const partsFormats = new Map<string, Intl.DateTimeFormat>();
function partsFormat(timeZone: string): Intl.DateTimeFormat {
  let f = partsFormats.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    partsFormats.set(timeZone, f);
  }
  return f;
}

interface WallTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** Heure murale d'un instant dans le fuseau. */
export function wallTime(at: Date, timeZone: string): WallTime {
  const out: WallTime = {
    year: 0,
    month: 0,
    day: 0,
    hour: 0,
    minute: 0,
    second: 0,
  };
  for (const p of partsFormat(timeZone).formatToParts(at)) {
    if (p.type in out && p.type !== "literal") {
      const value = Number(p.value);
      if (p.type === "year") out.year = value;
      else if (p.type === "month") out.month = value;
      else if (p.type === "day") out.day = value;
      else if (p.type === "hour") out.hour = value % 24;
      else if (p.type === "minute") out.minute = value;
      else if (p.type === "second") out.second = value;
    }
  }
  return out;
}

/** Jour « AAAA-MM-JJ » d'un instant dans le fuseau. */
export function dayKeyIn(at: Date, timeZone: string): string {
  const w = wallTime(at, timeZone);
  return `${w.year}-${pad(w.month)}-${pad(w.day)}`;
}

/** Minutes depuis minuit, dans le fuseau. */
export function minutesIn(at: Date, timeZone: string): number {
  const w = wallTime(at, timeZone);
  return w.hour * 60 + w.minute;
}

function parseKey(key: string): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return [1970, 1, 1];
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** Minuit UTC du jour (sert au calcul et à l'affichage du jour seul). */
export function keyToUtc(key: string): Date {
  const [y, m, d] = parseKey(key);
  return new Date(Date.UTC(y, m - 1, d));
}

const utcKey = (d: Date) =>
  `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

export function addDaysKey(key: string, n: number): string {
  const d = keyToUtc(key);
  d.setUTCDate(d.getUTCDate() + n);
  return utcKey(d);
}

export function addMonthsKey(key: string, n: number): string {
  const [y, m] = parseKey(key);
  return utcKey(new Date(Date.UTC(y, m - 1 + n, 1)));
}

/** Jour de la semaine ISO : 1 = lundi … 7 = dimanche. */
export function isoWeekdayKey(key: string): number {
  const d = keyToUtc(key).getUTCDay();
  return d === 0 ? 7 : d;
}

export function startOfWeekKey(key: string): string {
  return addDaysKey(key, -(isoWeekdayKey(key) - 1));
}

export function weekKeys(key: string): string[] {
  const monday = startOfWeekKey(key);
  return Array.from({ length: 7 }, (_, i) => addDaysKey(monday, i));
}

/** Les 42 cases de la grille mensuelle (6 semaines pleines). */
export function monthKeys(key: string): string[] {
  const [y, m] = parseKey(key);
  const start = startOfWeekKey(`${y}-${pad(m)}-01`);
  return Array.from({ length: 42 }, (_, i) => addDaysKey(start, i));
}

export const monthOf = (key: string) => key.slice(0, 7);

/** Décalage du fuseau à un instant, en millisecondes. */
function offsetAt(at: number, timeZone: string): number {
  const w = wallTime(new Date(at), timeZone);
  const asUtc = Date.UTC(
    w.year,
    w.month - 1,
    w.day,
    w.hour,
    w.minute,
    w.second,
  );
  return asUtc - Math.floor(at / 1000) * 1000;
}

/** Instant d'un jour et d'une heure murale (minutes depuis minuit) du fuseau. */
export function zonedInstant(
  key: string,
  minutes: number,
  timeZone: string,
): Date {
  const [y, m, d] = parseKey(key);
  const guess = Date.UTC(y, m - 1, d, 0, minutes);
  const first = guess - offsetAt(guess, timeZone);
  const second = guess - offsetAt(first, timeZone);
  return new Date(second);
}

/** « HH:MM » depuis des minutes. */
export function clockOf(minutes: number): string {
  return `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`;
}
