/**
 * Temps de l'agenda : récurrence des disponibilités, fuseaux horaires et
 * conflits de créneaux. Fonctions pures, sans base ni dépendance.
 *
 * Une disponibilité est décrite dans l'heure locale du prof (« le mardi de
 * 17 h à 19 h, heure de son fuseau ») : elle suit les changements d'heure de
 * ce fuseau. Une séance, elle, est un instant absolu (UTC) ; chacun la voit
 * dans son propre fuseau.
 */

/** Règle de disponibilité récurrente, dans le fuseau du prof. */
export interface AvailabilityRule {
  /** Jours retenus, au format ISO : 1 = lundi … 7 = dimanche. */
  weekdays: readonly number[];
  /** Minutes depuis minuit, heure locale. */
  startMinute: number;
  endMinute: number;
  /** Fuseau IANA (ex. « Africa/Porto-Novo », « Europe/Paris »). */
  timeZone: string;
  /** Première date possible, « AAAA-MM-JJ », dans le fuseau du prof. */
  validFrom: string;
  /** Dernière date possible, incluse, ou `null` sans fin. */
  validUntil: string | null;
  /** 1 = toutes les semaines, 2 = une semaine sur deux… */
  everyNWeeks: number;
}

export interface Interval {
  start: Date;
  end: Date;
}

/** Garde-fou : nombre maximal de plages développées en une fois. */
export const MAX_EXPANDED_WINDOWS = 2000;

const DAY_MS = 86_400_000;

/** Vrai si le fuseau est connu de l'environnement (Intl). */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** « AAAA-MM-JJ » valide (date du calendrier, sans fuseau). */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value);
}

/** « HH:MM » vers des minutes depuis minuit, ou `null` si invalide. */
export function parseClock(value: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59 || (h === 24 && min > 0)) return null;
  return h * 60 + min;
}

/** Minutes depuis minuit vers « HH:MM ». */
export function formatClock(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

const partsCache = new Map<string, Intl.DateTimeFormat>();
function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = partsCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsCache.set(timeZone, f);
  }
  return f;
}

/** Composantes de l'heure locale d'un instant dans un fuseau. */
export function zonedParts(
  instant: Date,
  timeZone: string,
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const values: Record<string, number> = {};
  for (const p of formatter(timeZone).formatToParts(instant))
    if (p.type !== "literal") values[p.type] = Number(p.value);
  return {
    year: values.year ?? 0,
    month: values.month ?? 0,
    day: values.day ?? 0,
    hour: (values.hour ?? 0) % 24,
    minute: values.minute ?? 0,
    second: values.second ?? 0,
  };
}

/** Décalage du fuseau à cet instant, en millisecondes (heure locale − UTC). */
export function timeZoneOffsetMs(instant: Date, timeZone: string): number {
  const p = zonedParts(instant, timeZone);
  const asUtc = Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    p.hour,
    p.minute,
    p.second,
  );
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * Instant correspondant à une date et une heure locales dans un fuseau.
 * Une heure qui n'existe pas (passage à l'heure d'été) est décalée d'autant
 * que le saut ; une heure qui existe deux fois (retour à l'heure d'hiver)
 * prend la première.
 */
export function zonedTimeToUtc(
  isoDate: string,
  minutes: number,
  timeZone: string,
): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  const naive = Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1, 0, minutes);
  // Décalages possibles ce jour-là : ceux de la veille et du lendemain (un
  // changement d'heure n'en a jamais plus de deux à moins d'un jour d'écart).
  const offsets = [
    timeZoneOffsetMs(new Date(naive - DAY_MS), timeZone),
    timeZoneOffsetMs(new Date(naive + DAY_MS), timeZone),
  ];
  const exact = offsets
    .map((o) => naive - o)
    .filter((t) => t + timeZoneOffsetMs(new Date(t), timeZone) === naive);
  if (exact.length > 0) return new Date(Math.min(...exact));
  // Heure inexistante (saut en avant) : décalée d'autant que le saut.
  return new Date(naive - Math.min(...offsets));
}

/** Date locale (« AAAA-MM-JJ ») d'un instant dans un fuseau. */
export function zonedDate(instant: Date, timeZone: string): string {
  const p = zonedParts(instant, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

function addDays(isoDate: string, n: number): string {
  const t = new Date(`${isoDate}T00:00:00.000Z`).getTime() + n * DAY_MS;
  return new Date(t).toISOString().slice(0, 10);
}

/** Jour ISO de la semaine d'une date du calendrier (1 = lundi). */
export function isoWeekday(isoDate: string): number {
  const day = new Date(`${isoDate}T00:00:00.000Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(`${b}T00:00:00.000Z`).getTime() -
      new Date(`${a}T00:00:00.000Z`).getTime()) /
      DAY_MS,
  );
}

/**
 * Développe une règle en plages concrètes qui touchent [from, to[. Les plages
 * sont calculées jour par jour dans le fuseau du prof : « 17 h – 19 h » reste
 * 17 h – 19 h locales de part et d'autre d'un changement d'heure.
 */
export function expandRule(
  rule: AvailabilityRule,
  from: Date,
  to: Date,
): Interval[] {
  const weekdays = new Set(
    rule.weekdays.filter((w) => Number.isInteger(w) && w >= 1 && w <= 7),
  );
  if (
    weekdays.size === 0 ||
    rule.endMinute <= rule.startMinute ||
    to.getTime() <= from.getTime()
  )
    return [];
  const step = Math.max(1, Math.floor(rule.everyNWeeks));
  // Lundi de la semaine de départ : référence pour « une semaine sur deux ».
  const mondayRef = addDays(rule.validFrom, -(isoWeekday(rule.validFrom) - 1));
  // Un jour de marge de chaque côté : la date locale peut différer de la date UTC.
  let day = zonedDate(new Date(from.getTime() - DAY_MS), rule.timeZone);
  if (day < rule.validFrom) day = rule.validFrom;
  const last = zonedDate(new Date(to.getTime() + DAY_MS), rule.timeZone);
  const out: Interval[] = [];
  while (day <= last && (rule.validUntil === null || day <= rule.validUntil)) {
    if (
      weekdays.has(isoWeekday(day)) &&
      Math.floor(daysBetween(mondayRef, day) / 7) % step === 0
    ) {
      const start = zonedTimeToUtc(day, rule.startMinute, rule.timeZone);
      const end = zonedTimeToUtc(day, rule.endMinute, rule.timeZone);
      if (
        end.getTime() > start.getTime() &&
        start.getTime() < to.getTime() &&
        end.getTime() > from.getTime()
      ) {
        out.push({ start, end });
        if (out.length >= MAX_EXPANDED_WINDOWS) break;
      }
    }
    day = addDays(day, 1);
  }
  return out;
}

/** Deux intervalles se chevauchent-ils ? Le contact bord à bord ne compte pas. */
export function overlaps(a: Interval, b: Interval): boolean {
  return (
    a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime()
  );
}

/** Vrai si `inner` est entièrement contenu dans l'une des plages. */
export function fitsInside(inner: Interval, windows: readonly Interval[]) {
  return windows.some(
    (w) =>
      w.start.getTime() <= inner.start.getTime() &&
      inner.end.getTime() <= w.end.getTime(),
  );
}

/**
 * Créneaux libres : chaque plage est découpée en créneaux de `slotMinutes`,
 * et un créneau qui chevauche une séance déjà prise est retiré. Les créneaux
 * qui commencent avant `notBefore` (passé, délai de prévenance) sont écartés.
 */
export function freeSlots(
  windows: readonly Interval[],
  busy: readonly Interval[],
  slotMinutes: number,
  notBefore: Date,
): Interval[] {
  const step = Math.max(5, Math.floor(slotMinutes)) * 60_000;
  const out: Interval[] = [];
  const seen = new Set<number>();
  for (const w of [...windows].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  )) {
    for (let t = w.start.getTime(); t + step <= w.end.getTime(); t += step) {
      const slot = { start: new Date(t), end: new Date(t + step) };
      if (t < notBefore.getTime() || seen.has(t)) continue;
      if (busy.some((b) => overlaps(slot, b))) continue;
      seen.add(t);
      out.push(slot);
    }
  }
  return out;
}
