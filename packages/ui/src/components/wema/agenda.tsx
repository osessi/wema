"use client";

import {
  ArrowSquareOut,
  CalendarCheck,
  CaretLeft,
  CaretRight,
  Clock,
  MapPin,
  UsersThree,
  VideoCamera,
} from "@phosphor-icons/react";
import {
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";
import { Button, buttonVariants } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group";
import {
  addDaysKey,
  addMonthsKey,
  clockOf,
  dayKeyIn,
  isoWeekdayKey,
  keyToUtc,
  minutesIn,
  monthKeys,
  monthOf,
  weekKeys,
  zonedInstant,
} from "./agenda-dates";
import { PersonAvatar } from "./person-avatar";

export {
  addDaysKey,
  dayKeyIn,
  minutesIn,
  zonedInstant,
} from "./agenda-dates";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type AgendaView = "week" | "month";

/** Statuts d'une séance (`SessionStatus` de l'API agenda). */
export type AgendaSessionStatus =
  | "requested"
  | "proposed"
  | "confirmed"
  | "declined"
  | "cancelled"
  | "done";

export type AgendaTone =
  | "brand"
  | "ink"
  | "mint"
  | "butter"
  | "peach"
  | "rose"
  | "lime"
  | "sand";

/**
 * Élément de l'agenda : une séance ou l'échéance d'un devoir. Mêmes champs
 * que l'`AgendaEvent` de `apps/web/src/components/agenda/views.tsx`, plus
 * une couleur et le droit d'être déplacé.
 */
export interface AgendaEvent {
  id: string;
  type: "session" | "assignment";
  start: Date;
  end: Date;
  label: string;
  href: string | null;
  status: AgendaSessionStatus | null;
  group: boolean;
  done: boolean;
  /** Couleur ; par défaut jaune (individuelle), menthe (groupe), beurre (devoir). */
  tone?: AgendaTone | undefined;
  /** Déplaçable au glisser-déposer (si `onMove` est fourni). Séances seulement. */
  movable?: boolean | undefined;
  /** Participants montrés dans l'aperçu (avatars colorés par identifiant). */
  participants?: readonly { id: string; name: string }[] | undefined;
  /** Lien de visio ou lieu, montré dans l'aperçu s'il existe. */
  place?:
    | { kind: "visio" | "place"; label: string; href?: string | undefined }
    | undefined;
}

/** Plage de disponibilité, teintée dans la vue semaine. */
export interface AgendaWindow {
  start: Date;
  end: Date;
}

export interface AgendaLabels {
  today: string;
  previous: string;
  next: string;
  view: string;
  week: string;
  month: string;
  available: string;
  /** Rangée des échéances en tête de la vue semaine. */
  dueRow: string;
  assignment: string;
  /** `{date}` et `{time}` remplacés. */
  addAt: string;
  /** `{count}` remplacé. */
  more: (count: number) => string;
  /** `{zone}` remplacé ; vide pour ne rien afficher. */
  timeZone: string;
  status: Record<AgendaSessionStatus, string>;
  /** Annonce après un déplacement : `{label}`, `{date}`, `{time}`. */
  moved: string;
  /** Aperçu d'un élément : bouton qui ouvre sa page. */
  open: string;
  participants: string;
  /** Durée d'une séance, en minutes. */
  duration: (minutes: number) => string;
}

const DEFAULT_LABELS: AgendaLabels = {
  today: "Aujourd'hui",
  previous: "Période précédente",
  next: "Période suivante",
  view: "Affichage",
  week: "Semaine",
  month: "Mois",
  available: "Disponible",
  dueRow: "Échéances",
  assignment: "Devoir",
  addAt: "Planifier une séance le {date} à {time}",
  more: (count) => (count === 1 ? "et 1 autre" : `et ${count} autres`),
  timeZone: "Heures affichées dans le fuseau : {zone}",
  status: {
    requested: "Demandée",
    proposed: "Nouvel horaire proposé",
    confirmed: "Confirmée",
    declined: "Refusée",
    cancelled: "Annulée",
    done: "Terminée",
  },
  moved: "{label} déplacée au {date} à {time}",
  open: "Ouvrir",
  participants: "Participants",
  duration: (minutes) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m} min`;
    return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
  },
};

/** Couleur du badge de statut dans l'aperçu. */
const STATUS_BADGE: Record<
  AgendaSessionStatus,
  "success" | "warning" | "info" | "neutral" | "danger"
> = {
  confirmed: "success",
  requested: "warning",
  proposed: "info",
  done: "neutral",
  declined: "danger",
  cancelled: "danger",
};

export interface AgendaProps {
  view: AgendaView;
  onViewChange: (view: AgendaView) => void;
  /** Un instant de la période affichée. */
  anchor: Date;
  /** Reçoit midi (heure du fuseau) du jour visé. */
  onAnchorChange: (anchor: Date) => void;
  events: AgendaEvent[];
  windows?: AgendaWindow[] | undefined;
  /** Fuseau IANA d'affichage (celui de la personne, ou de l'école). */
  timeZone: string;
  /** Clic sur une case horaire vide (espace prof) : jour « AAAA-MM-JJ », heure « HH:MM ». */
  onCreate?: ((day: string, time: string) => void) | undefined;
  /** Ouvre un jour (clic sur sa date dans la vue mois, « et 2 autres »). */
  onOpenDay?: ((day: string) => void) | undefined;
  /**
   * Glisser-déposer : nouvelle heure de début et de fin (même durée). Le
   * dialogue « Replanifier » reste l'alternative au clavier.
   */
  onMove?: ((event: AgendaEvent, start: Date, end: Date) => void) | undefined;
  /** Clic sur un élément sans `href` (sans aperçu). */
  onEventSelect?: ((event: AgendaEvent) => void) | undefined;
  /**
   * Aperçu : un clic (ou Entrée) sur un élément ouvre une fenêtre avec son
   * titre, sa date, sa durée, ses participants, son statut et son lieu ;
   * « Ouvrir » mène à sa page (`href`).
   */
  preview?: boolean | undefined;
  /** Actions de l'aperçu (« Confirmer », « Annuler »), avant « Ouvrir ». */
  previewActions?:
    | ((event: AgendaEvent, close: () => void) => ReactNode)
    | undefined;
  /** Rendu d'un lien (le `Link` de Next) ; `<a>` par défaut. */
  renderLink?:
    | ((props: {
        href: string;
        className: string;
        style?: CSSProperties | undefined;
        children: ReactNode;
        onClick: (e: ReactMouseEvent) => void;
        onPointerDown?: ((e: ReactPointerEvent) => void) | undefined;
        title: string;
      }) => ReactNode)
    | undefined;
  labels?: Partial<AgendaLabels> | undefined;
  /** Boutons à droite de la barre (« Planifier », filtres). */
  actions?: ReactNode | undefined;
  /** Plage horaire minimale de la vue semaine, élargie aux séances. */
  dayStartHour?: number | undefined;
  dayEndHour?: number | undefined;
  className?: string | undefined;
}

/* -------------------------------------------------------------------------- */
/* Formats fr-FR                                                              */
/* -------------------------------------------------------------------------- */

const HOUR_HEIGHT = 52;
const SNAP = 15;

const dayFormat = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", ...options });
const fmtWeekday = dayFormat({ weekday: "short" });
const fmtLong = dayFormat({ weekday: "long", day: "numeric", month: "long" });
const fmtMonth = dayFormat({ month: "long", year: "numeric" });
const fmtDayMonth = dayFormat({ day: "numeric", month: "short" });
const fmtDayMonthYear = dayFormat({
  day: "numeric",
  month: "short",
  year: "numeric",
});

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? "");

const longDay = (key: string) => fmtLong.format(keyToUtc(key));

function periodTitle(view: AgendaView, key: string): string {
  if (view === "month") {
    const t = fmtMonth.format(keyToUtc(key));
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  const days = weekKeys(key);
  const first = days[0] ?? key;
  const last = days[6] ?? key;
  return `${fmtDayMonth.format(keyToUtc(first))} – ${fmtDayMonthYear.format(keyToUtc(last))}`;
}

/* -------------------------------------------------------------------------- */
/* Couleurs                                                                   */
/* -------------------------------------------------------------------------- */

const TONES: Record<AgendaTone, { body: string; bar: string }> = {
  brand: { body: "bg-brand-soft text-foreground", bar: "bg-brand" },
  ink: { body: "bg-card text-foreground", bar: "bg-foreground" },
  mint: { body: "bg-mint text-mint-ink", bar: "bg-mint-ink" },
  butter: { body: "bg-butter text-butter-ink", bar: "bg-butter-ink" },
  peach: { body: "bg-peach text-peach-ink", bar: "bg-peach-ink" },
  rose: { body: "bg-rose text-rose-ink", bar: "bg-rose-ink" },
  lime: { body: "bg-lime text-lime-ink", bar: "bg-lime-ink" },
  sand: { body: "bg-sand text-sand-ink", bar: "bg-sand-ink" },
};

const toneOf = (e: AgendaEvent): AgendaTone =>
  e.tone ?? (e.type === "assignment" ? "butter" : e.group ? "mint" : "brand");

/* -------------------------------------------------------------------------- */
/* Glisser-déposer (souris, stylet ; appui long au doigt)                     */
/* -------------------------------------------------------------------------- */

interface DragTarget {
  day: string;
  minutes: number;
}

interface DragState {
  event: AgendaEvent;
  pointerId: number;
  pointerType: string;
  x: number;
  y: number;
  active: boolean;
  /** Minutes entre le début de la séance et l'endroit saisi (vue semaine). */
  grab: number;
  target: DragTarget | null;
  timer: number | null;
}

/* -------------------------------------------------------------------------- */
/* Composant                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Agenda semaine et mois, en français et dans le fuseau donné (structure
 * de CalendarCN : barre avec période, sélecteur de vue et navigation ; grille
 * horaire ; grille mensuelle). Couleurs par type de séance, toujours doublées
 * d'une icône et d'un libellé. Les séances se déplacent au glisser-déposer
 * (pas de 15 min), au doigt après un appui long.
 */
export function Agenda({
  view,
  onViewChange,
  anchor,
  onAnchorChange,
  events,
  windows = [],
  timeZone,
  onCreate,
  onOpenDay,
  onMove,
  onEventSelect,
  preview = false,
  previewActions,
  renderLink,
  labels: labelsProp,
  actions,
  dayStartHour = 8,
  dayEndHour = 20,
  className,
}: AgendaProps) {
  const labels = {
    ...DEFAULT_LABELS,
    ...labelsProp,
    status: { ...DEFAULT_LABELS.status, ...labelsProp?.status },
  };
  const anchorKey = dayKeyIn(anchor, timeZone);
  const [now, setNow] = useState<Date | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [announce, setAnnounce] = useState("");
  /** Élément dont l'aperçu est ouvert (`id@case`, une séance peut couvrir deux jours). */
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const swallowClick = useRef(false);
  const weekBodyFirstHour = useRef(dayStartHour);

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const todayKey = now ? dayKeyIn(now, timeZone) : null;

  const go = (key: string) =>
    onAnchorChange(zonedInstant(key, 12 * 60, timeZone));
  const shift = (step: number) =>
    go(
      view === "week"
        ? addDaysKey(anchorKey, 7 * step)
        : addMonthsKey(anchorKey, step),
    );

  /* ---- glisser-déposer ---- */

  function setDragState(next: DragState | null) {
    dragRef.current = next;
    setDrag(next);
  }

  function targetAt(x: number, y: number, state: DragState): DragTarget | null {
    for (const el of document.elementsFromPoint(x, y)) {
      if (!(el instanceof HTMLElement)) continue;
      const day = el.dataset.agendaDay;
      if (!day) continue;
      if (el.dataset.agendaColumn !== undefined) {
        const rect = el.getBoundingClientRect();
        const raw =
          weekBodyFirstHour.current * 60 +
          ((y - rect.top) / HOUR_HEIGHT) * 60 -
          state.grab;
        const minutes = Math.max(
          0,
          Math.min(24 * 60 - SNAP, Math.round(raw / SNAP) * SNAP),
        );
        return { day, minutes };
      }
      return { day, minutes: minutesIn(state.event.start, timeZone) };
    }
    return null;
  }

  // Les gestionnaires lisent l'état courant par `dragRef` : on ne se réabonne qu'au début d'un geste.
  // biome-ignore lint/correctness/useExhaustiveDependencies: voir ci-dessus
  useEffect(() => {
    if (!drag) return;
    const pointerId = drag.pointerId;
    function move(e: PointerEvent) {
      const s = dragRef.current;
      if (!s || e.pointerId !== pointerId) return;
      const dist = Math.hypot(e.clientX - s.x, e.clientY - s.y);
      if (!s.active) {
        if (s.pointerType === "touch") {
          if (dist > 8) {
            if (s.timer !== null) window.clearTimeout(s.timer);
            setDragState(null);
          }
          return;
        }
        if (dist < 5) return;
        setDragState({
          ...s,
          active: true,
          target: targetAt(e.clientX, e.clientY, s),
        });
        return;
      }
      setDragState({ ...s, target: targetAt(e.clientX, e.clientY, s) });
    }
    function up(e: PointerEvent) {
      const s = dragRef.current;
      if (!s || e.pointerId !== pointerId) return;
      if (s.timer !== null) window.clearTimeout(s.timer);
      setDragState(null);
      if (!s.active) return;
      swallowClick.current = true;
      window.setTimeout(() => {
        swallowClick.current = false;
      }, 400);
      if (!s.target || !onMove) return;
      const start = zonedInstant(s.target.day, s.target.minutes, timeZone);
      if (start.getTime() === s.event.start.getTime()) return;
      const end = new Date(
        start.getTime() + (s.event.end.getTime() - s.event.start.getTime()),
      );
      onMove(s.event, start, end);
      setAnnounce(
        fill(labels.moved, {
          label: s.event.label,
          date: longDay(s.target.day),
          time: clockOf(s.target.minutes),
        }),
      );
    }
    function blockTouch(e: TouchEvent) {
      if (dragRef.current?.active && e.cancelable) e.preventDefault();
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("touchmove", blockTouch, { passive: false });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("touchmove", blockTouch);
    };
  }, [drag?.pointerId]);

  function startDrag(e: ReactPointerEvent, event: AgendaEvent, grab: number) {
    if (!onMove || event.type !== "session" || event.movable === false) return;
    if (!e.isPrimary || e.button !== 0) return;
    // Souris et stylet : pas de sélection de texte pendant le geste.
    if (e.pointerType !== "touch") e.preventDefault();
    const base: DragState = {
      event,
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      x: e.clientX,
      y: e.clientY,
      active: false,
      grab,
      target: null,
      timer: null,
    };
    if (e.pointerType === "touch") {
      base.timer = window.setTimeout(() => {
        const s = dragRef.current;
        if (s && !s.active)
          setDragState({
            ...s,
            active: true,
            timer: null,
            target: targetAt(s.x, s.y, s),
          });
      }, 350);
    }
    setDragState(base);
  }

  /* ---- éléments ---- */

  // Fonctions de rendu (et non composants) : rien n'est remonté pendant un glisser.
  function chip({
    event,
    compact,
    style,
    className: extra,
    grabFrom,
    instance = "",
  }: {
    event: AgendaEvent;
    /** Case où la puce est posée (clé de l'aperçu). */
    instance?: string;
    compact?: boolean;
    style?: CSSProperties;
    className?: string;
    /** Vue semaine : calcule la prise à partir du haut de la puce. */
    grabFrom?: boolean;
  }) {
    const tone = TONES[toneOf(event)];
    const status = event.status ?? "confirmed";
    const Icon =
      event.type === "assignment"
        ? CalendarCheck
        : event.group
          ? UsersThree
          : VideoCamera;
    const start = minutesIn(event.start, timeZone);
    const end = minutesIn(event.end, timeZone);
    const statusText =
      event.type === "assignment" ? labels.assignment : labels.status[status];
    const title = `${event.label} · ${clockOf(start)}${event.type === "session" ? `–${clockOf(end)}` : ""} · ${statusText}`;
    const dragging = drag?.active && drag.event.id === event.id;
    const movable =
      onMove !== undefined &&
      event.type === "session" &&
      event.movable !== false;
    const classes = cn(
      "group/chip relative flex w-full min-w-0 overflow-hidden rounded-chip py-1 pr-1.5 pl-2.5 text-left text-[11px] leading-tight outline-none transition-[opacity,box-shadow]",
      compact ? "items-center gap-1" : "flex-col gap-0.5",
      tone.body,
      (status === "requested" || status === "proposed") &&
        "border border-dashed border-current/40",
      status === "done" && "opacity-70",
      (status === "cancelled" || status === "declined") &&
        "bg-muted text-muted-foreground line-through",
      event.type === "assignment" && event.done && "opacity-60",
      (event.href || onEventSelect || preview) &&
        "cursor-pointer hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring",
      movable && "touch-manipulation select-none",
      dragging && "opacity-40",
      extra,
    );
    const body = (
      <>
        <span
          aria-hidden
          className={cn("absolute inset-y-0 left-0 w-1", tone.bar)}
        />
        <span className="flex items-center gap-1 font-medium tabular-nums">
          <Icon aria-hidden className="size-3 shrink-0" />
          {clockOf(start)}
          {!compact && event.type === "session" ? ` – ${clockOf(end)}` : ""}
        </span>
        <span className="min-w-0 truncate">{event.label}</span>
        <span className="sr-only">, {statusText}</span>
      </>
    );
    const onClick = (e: ReactMouseEvent) => {
      if (swallowClick.current) {
        e.preventDefault();
        return;
      }
      if (!event.href) onEventSelect?.(event);
    };
    const onPointerDown = movable
      ? (e: ReactPointerEvent) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const grab = grabFrom
            ? Math.round(((e.clientY - rect.top) / HOUR_HEIGHT) * 60)
            : 0;
          startDrag(e, event, grab);
        }
      : undefined;
    if (preview) {
      const key = `${event.id}@${instance}`;
      return (
        <Popover
          open={previewKey === key}
          onOpenChange={(open) => setPreviewKey(open ? key : null)}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              className={classes}
              style={style}
              onClick={(e) => {
                if (swallowClick.current) e.preventDefault();
              }}
              onPointerDown={onPointerDown}
              title={title}
              aria-haspopup="dialog"
            >
              {body}
            </button>
          </PopoverTrigger>
          {previewKey === key ? previewCard(event, statusText, Icon) : null}
        </Popover>
      );
    }
    if (event.href) {
      const props = {
        href: event.href,
        className: classes,
        style,
        children: body,
        onClick,
        onPointerDown,
        title,
      };
      return renderLink ? (
        renderLink(props)
      ) : (
        <a
          href={props.href}
          className={classes}
          style={style}
          onClick={onClick}
          onPointerDown={onPointerDown}
          title={title}
        >
          {body}
        </a>
      );
    }
    return onEventSelect ? (
      <button
        type="button"
        className={classes}
        style={style}
        onClick={onClick}
        onPointerDown={onPointerDown}
        title={title}
      >
        {body}
      </button>
    ) : (
      <div
        className={classes}
        style={style}
        title={title}
        onPointerDown={onPointerDown}
      >
        {body}
      </div>
    );
  }

  /* ---- aperçu ---- */

  function previewCard(
    event: AgendaEvent,
    statusText: string,
    Icon: typeof VideoCamera,
  ) {
    const close = () => setPreviewKey(null);
    // Rien à proposer : pas de barre d'actions vide.
    const extraActions = previewActions?.(event, close) ?? null;
    const tone = TONES[toneOf(event)];
    const titleId = `agenda-preview-${event.id}`;
    const startMin = minutesIn(event.start, timeZone);
    const endMin = minutesIn(event.end, timeZone);
    const minutes = Math.round(
      (event.end.getTime() - event.start.getTime()) / 60_000,
    );
    const day = longDay(dayKeyIn(event.start, timeZone));
    const people = event.participants ?? [];
    const PlaceIcon = event.place?.kind === "visio" ? VideoCamera : MapPin;
    const openClass = buttonVariants({ variant: "outline", size: "sm" });
    const openBody = (
      <>
        <ArrowSquareOut aria-hidden />
        {labels.open}
      </>
    );
    return (
      <PopoverContent
        align="start"
        collisionPadding={12}
        aria-labelledby={titleId}
        // Le focus va à la fenêtre elle-même, pas à « Annuler » : Tab mène aux actions.
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          if (e.currentTarget instanceof HTMLElement) e.currentTarget.focus();
        }}
        className="w-[min(20rem,calc(100vw-24px))] overflow-hidden rounded-[16px] p-0 shadow-lg"
      >
        <div className="space-y-3 p-4">
          <div className="flex items-start gap-2.5">
            <span
              aria-hidden
              className={cn(
                "mt-1.5 size-2.5 shrink-0 rounded-full ring-2 ring-background",
                tone.bar,
              )}
            />
            <div className="min-w-0 space-y-0.5">
              <p
                id={titleId}
                className="font-medium leading-snug break-words text-foreground"
              >
                {event.label}
              </p>
              <p className="text-sm text-muted-foreground first-letter:uppercase">
                {day} ·{" "}
                <span className="tabular-nums">
                  {clockOf(startMin)}
                  {event.type === "session" ? ` – ${clockOf(endMin)}` : ""}
                </span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={
                event.type === "assignment"
                  ? event.done
                    ? "success"
                    : "neutral"
                  : STATUS_BADGE[event.status ?? "confirmed"]
              }
            >
              <Icon aria-hidden weight="bold" />
              {statusText}
            </Badge>
            {event.type === "session" && minutes > 0 ? (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                <Clock aria-hidden className="size-3.5" />
                {labels.duration(minutes)}
              </span>
            ) : null}
          </div>
          {people.length > 0 ? (
            <div className="space-y-1.5">
              <p className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
                {labels.participants}
              </p>
              <ul className="flex flex-wrap gap-x-3 gap-y-1.5">
                {people.map((p) => (
                  <li
                    key={p.id}
                    className="flex min-w-0 items-center gap-1.5 text-sm"
                  >
                    <PersonAvatar
                      name={p.name}
                      seed={p.id}
                      size="sm"
                      decorative
                    />
                    <span className="truncate">{p.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {event.place ? (
            <p className="flex min-w-0 items-center gap-1.5 text-sm">
              <PlaceIcon
                aria-hidden
                className="size-4 shrink-0 text-muted-foreground"
              />
              {event.place.href ? (
                <a
                  href={event.place.href}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground"
                >
                  {event.place.label}
                </a>
              ) : (
                <span className="truncate">{event.place.label}</span>
              )}
            </p>
          ) : null}
        </div>
        {event.href || extraActions ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t bg-muted/40 px-4 py-3">
            {extraActions}
            {event.href ? (
              renderLink ? (
                renderLink({
                  href: event.href,
                  className: openClass,
                  children: openBody,
                  onClick: close,
                  title: labels.open,
                })
              ) : (
                <a href={event.href} className={openClass} onClick={close}>
                  {openBody}
                </a>
              )
            ) : null}
          </div>
        ) : null}
      </PopoverContent>
    );
  }

  /* ---- vue semaine ---- */

  function weekView() {
    const days = weekKeys(anchorKey);
    const timed = events.filter((e) => e.type === "session");
    const due = events.filter((e) => e.type === "assignment");
    let first = dayStartHour;
    let last = dayEndHour;
    for (const e of [...timed, ...windows]) {
      first = Math.min(first, Math.floor(minutesIn(e.start, timeZone) / 60));
      const sameDay = dayKeyIn(e.start, timeZone) === dayKeyIn(e.end, timeZone);
      last = Math.max(
        last,
        sameDay ? Math.ceil(minutesIn(e.end, timeZone) / 60) : 24,
      );
    }
    weekBodyFirstHour.current = first;
    const hours = Array.from({ length: last - first }, (_, i) => first + i);
    const height = hours.length * HOUR_HEIGHT;

    const place = (start: Date, end: Date, day: string) => {
      const dayStart = zonedInstant(day, 0, timeZone).getTime();
      const from = Math.max(start.getTime(), dayStart + first * 3_600_000);
      const to = Math.min(end.getTime(), dayStart + last * 3_600_000);
      const top = ((from - dayStart) / 3_600_000 - first) * HOUR_HEIGHT;
      const h = Math.max(((to - from) / 3_600_000) * HOUR_HEIGHT, 22);
      return { top: Math.max(0, Math.min(top, height - h)), height: h };
    };

    return (
      <div className="relative max-w-full overflow-x-auto overscroll-x-contain">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-[52px_repeat(7,minmax(0,1fr))] border-b bg-muted/40">
            <div className="flex items-end justify-end px-1.5 pb-2 font-mono text-[10px] text-muted-foreground uppercase">
              {due.length > 0 ? (
                <span className="sr-only">{labels.dueRow}</span>
              ) : null}
            </div>
            {days.map((key) => {
              const list = due.filter(
                (e) => dayKeyIn(e.start, timeZone) === key,
              );
              const today = key === todayKey;
              return (
                <div
                  key={key}
                  data-agenda-day={key}
                  className="relative min-w-0 space-y-1 border-l px-1 py-2 text-center"
                >
                  <p className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
                    {fmtWeekday.format(keyToUtc(key)).replace(".", "")}
                  </p>
                  <p
                    className={cn(
                      "mx-auto grid size-7 place-items-center rounded-full text-sm font-semibold tabular-nums",
                      today && "bg-brand text-ink-on-brand",
                    )}
                  >
                    <span aria-hidden>{Number(key.slice(8))}</span>
                    <span className="sr-only">{longDay(key)}</span>
                  </p>
                  {list.map((e) => (
                    <div key={e.id} className="contents">
                      {chip({
                        event: e,
                        compact: true,
                        instance: `due-${key}`,
                      })}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          <div className="relative grid grid-cols-[52px_repeat(7,minmax(0,1fr))]">
            <div aria-hidden>
              {hours.map((h) => (
                <div
                  key={h}
                  style={{ height: HOUR_HEIGHT }}
                  className="-translate-y-1.5 pr-2 text-right font-mono text-[10px] text-muted-foreground tabular-nums"
                >
                  {h === first ? "" : clockOf(h * 60)}
                </div>
              ))}
            </div>
            {days.map((key) => {
              const dayStart = zonedInstant(key, 0, timeZone).getTime();
              const dayEnd = zonedInstant(
                addDaysKey(key, 1),
                0,
                timeZone,
              ).getTime();
              const inDay = (x: { start: Date; end: Date }) =>
                x.start.getTime() < dayEnd && x.end.getTime() > dayStart;
              const { placed, count } = lanes(timed.filter(inDay));
              const ghost =
                drag?.active && drag.target?.day === key && drag.target
                  ? drag.target
                  : null;
              const nowMinutes =
                now && key === todayKey ? minutesIn(now, timeZone) : null;
              return (
                <div
                  key={key}
                  data-agenda-day={key}
                  data-agenda-column=""
                  className={cn(
                    "relative border-l",
                    key === todayKey && "bg-brand/[0.04]",
                  )}
                  style={{ height }}
                >
                  {windows.filter(inDay).map((w) => {
                    const pos = place(w.start, w.end, key);
                    return (
                      <div
                        key={w.start.toISOString()}
                        aria-hidden
                        style={pos}
                        className="pointer-events-none absolute inset-x-0 bg-[repeating-linear-gradient(135deg,transparent_0_6px,var(--color-border)_6px_7px)] opacity-70"
                      />
                    );
                  })}
                  {hours.map((h) => {
                    const time = clockOf(h * 60);
                    return onCreate ? (
                      <button
                        key={h}
                        type="button"
                        onClick={() => onCreate(key, time)}
                        style={{ height: HOUR_HEIGHT }}
                        className="relative block w-full border-t border-border/60 outline-none transition-colors first:border-t-0 hover:bg-brand-soft/60 focus-visible:bg-brand-soft focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                        aria-label={fill(labels.addAt, {
                          date: longDay(key),
                          time,
                        })}
                      />
                    ) : (
                      <div
                        key={h}
                        style={{ height: HOUR_HEIGHT }}
                        className="border-t border-border/60 first:border-t-0"
                      />
                    );
                  })}
                  {nowMinutes !== null &&
                  nowMinutes >= first * 60 &&
                  nowMinutes <= last * 60 ? (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 z-20 h-0.5 bg-destructive"
                      style={{
                        top: ((nowMinutes - first * 60) / 60) * HOUR_HEIGHT,
                      }}
                    >
                      <span className="absolute -top-1 -left-1 size-2.5 rounded-full bg-destructive" />
                    </div>
                  ) : null}
                  {placed.map(({ event, lane }) => {
                    const pos = place(event.start, event.end, key);
                    return (
                      <div key={event.id} className="contents">
                        {chip({
                          event,
                          instance: key,
                          compact: pos.height < 40,
                          grabFrom: true,
                          className: "absolute z-10",
                          style: {
                            top: pos.top,
                            height: pos.height,
                            left: `calc(${(lane / count) * 100}% + 2px)`,
                            width: `calc(${100 / count}% - 4px)`,
                          },
                        })}
                      </div>
                    );
                  })}
                  {ghost ? (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0.5 z-30 rounded-chip border-2 border-dashed border-foreground/60 bg-background/70 px-1.5 py-0.5 font-mono text-[10px] font-medium tabular-nums"
                      style={{
                        top: ((ghost.minutes - first * 60) / 60) * HOUR_HEIGHT,
                        height: Math.max(
                          22,
                          (((drag?.event.end.getTime() ?? 0) -
                            (drag?.event.start.getTime() ?? 0)) /
                            3_600_000) *
                            HOUR_HEIGHT,
                        ),
                      }}
                    >
                      {clockOf(ghost.minutes)}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  /* ---- vue mois ---- */

  function monthView() {
    const cells = monthKeys(anchorKey);
    const month = monthOf(anchorKey);
    const byDay = new Map<string, AgendaEvent[]>();
    for (const e of events) {
      const key = dayKeyIn(e.start, timeZone);
      byDay.set(key, [...(byDay.get(key) ?? []), e]);
    }
    const freeDays = new Set(windows.map((w) => dayKeyIn(w.start, timeZone)));
    const weekdays = weekKeys(cells[0] ?? anchorKey);

    return (
      <div>
        <div className="grid grid-cols-7 border-b bg-muted/40">
          {weekdays.map((key) => (
            <div
              key={key}
              className="px-1 py-2 text-center font-mono text-[10px] tracking-wide text-muted-foreground uppercase"
            >
              {fmtWeekday.format(keyToUtc(key)).replace(".", "")}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((key) => {
            const list = (byDay.get(key) ?? []).sort(
              (a, b) => a.start.getTime() - b.start.getTime(),
            );
            const outside = monthOf(key) !== month;
            const target =
              drag?.active && drag.target?.day === key ? drag.target : null;
            return (
              <div
                key={key}
                data-agenda-day={key}
                className={cn(
                  "relative min-h-20 min-w-0 border-t border-l p-1 sm:min-h-28",
                  isoWeekdayKey(key) === 1 && "border-l-0",
                  outside && "bg-muted/30 text-muted-foreground",
                  target &&
                    "bg-brand-soft ring-2 ring-foreground/50 ring-inset",
                )}
              >
                <div className="flex items-center justify-between gap-1">
                  {onOpenDay ? (
                    <button
                      type="button"
                      onClick={() => onOpenDay(key)}
                      aria-label={longDay(key)}
                      className={cn(
                        "grid size-6 place-items-center rounded-full text-xs font-semibold tabular-nums outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring",
                        key === todayKey &&
                          "bg-brand text-ink-on-brand hover:bg-brand",
                      )}
                    >
                      {Number(key.slice(8))}
                    </button>
                  ) : (
                    <span
                      className={cn(
                        "grid size-6 place-items-center rounded-full text-xs font-semibold tabular-nums",
                        key === todayKey && "bg-brand text-ink-on-brand",
                      )}
                    >
                      <span aria-hidden>{Number(key.slice(8))}</span>
                      <span className="sr-only">{longDay(key)}</span>
                    </span>
                  )}
                  {freeDays.has(key) ? (
                    <span
                      className="hidden truncate rounded-full bg-mint px-1.5 text-[10px] text-mint-ink sm:inline"
                      title={labels.available}
                    >
                      {labels.available}
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 space-y-0.5">
                  {list.slice(0, 3).map((e) => (
                    <div key={e.id} className="contents">
                      {chip({ event: e, compact: true, instance: key })}
                    </div>
                  ))}
                  {list.length > 3 ? (
                    onOpenDay ? (
                      <button
                        type="button"
                        onClick={() => onOpenDay(key)}
                        className="pl-1 text-[10px] text-muted-foreground hover:underline"
                      >
                        {labels.more(list.length - 3)}
                      </button>
                    ) : (
                      <span className="pl-1 text-[10px] text-muted-foreground">
                        {labels.more(list.length - 3)}
                      </span>
                    )
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <section
      data-slot="agenda"
      aria-label={periodTitle(view, anchorKey)}
      className={cn(
        "relative min-w-0 overflow-hidden rounded-card border bg-card",
        className,
      )}
    >
      <header className="flex flex-wrap items-center gap-2 border-b px-3 py-2.5">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={labels.previous}
            onClick={() => shift(-1)}
          >
            <CaretLeft aria-hidden />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={labels.next}
            onClick={() => shift(1)}
          >
            <CaretRight aria-hidden />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => go(dayKeyIn(new Date(), timeZone))}
          >
            {labels.today}
          </Button>
        </div>
        <h2
          aria-live="polite"
          className="order-first min-w-0 basis-full truncate text-base font-semibold tabular-nums sm:order-none sm:flex-1 sm:basis-auto"
        >
          {periodTitle(view, anchorKey)}
        </h2>
        <ToggleGroup
          type="single"
          className="ml-auto"
          variant="outline"
          size="sm"
          aria-label={labels.view}
          value={view}
          onValueChange={(v) => {
            if (v === "week" || v === "month") onViewChange(v);
          }}
        >
          <ToggleGroupItem value="week">{labels.week}</ToggleGroupItem>
          <ToggleGroupItem value="month">{labels.month}</ToggleGroupItem>
        </ToggleGroup>
        {actions ? <div className="flex gap-2">{actions}</div> : null}
      </header>

      {view === "week" ? weekView() : monthView()}

      {labels.timeZone ? (
        <p className="border-t px-3 py-2 text-xs text-muted-foreground">
          {fill(labels.timeZone, { zone: timeZone })}
        </p>
      ) : null}
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
    </section>
  );
}

/** Répartit les séances d'un jour en colonnes quand elles se chevauchent. */
function lanes(events: AgendaEvent[]) {
  const sorted = [...events].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );
  const ends: number[] = [];
  const placed = sorted.map((event) => {
    let lane = ends.findIndex((end) => end <= event.start.getTime());
    if (lane === -1) {
      lane = ends.length;
      ends.push(event.end.getTime());
    } else ends[lane] = event.end.getTime();
    return { event, lane };
  });
  return { placed, count: Math.max(1, ends.length) };
}
