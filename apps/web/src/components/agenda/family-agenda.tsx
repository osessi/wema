"use client";

import {
  CalendarBlank,
  CalendarCheck,
  CalendarPlus,
  CaretLeft,
  CaretRight,
  ChalkboardTeacher,
  CheckCircle,
  CreditCard,
  UsersThree,
  VideoCamera,
} from "@phosphor-icons/react";
import { GlowTile } from "@wema/ui/components/brand/glow-tile";
import { ILLUSTRATION_FOR } from "@wema/ui/components/illustrations/illustration";
import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import { CARD_INNER_SHADOW, CardShell } from "@wema/ui/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@wema/ui/components/ui/dialog";
import { Field, FieldLabel, FieldSection } from "@wema/ui/components/ui/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@wema/ui/components/ui/native-select";
import { Spinner } from "@wema/ui/components/ui/spinner";
import { Textarea } from "@wema/ui/components/ui/textarea";
import { ChoiceCards } from "@wema/ui/components/wema/choice-cards";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import {
  PersonAvatar,
  PersonChip,
} from "@wema/ui/components/wema/person-avatar";
import { cn } from "@wema/ui/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type FormEvent, useEffect, useId, useState } from "react";
import { formatAmount } from "../../app/parent/abonnements/format";
import { read } from "../../lib/mutate";
import { AgendaCalendar } from "./calendar";
import { addDays, dayKey, startOfDay } from "./dates";
import { LocalDateTime } from "./local-time";
import { MethodSelect, startSessionCheckout } from "./session-payment";
import {
  type BookableLink,
  type FamilyData,
  SESSION_BADGE,
  sessionHref,
  type UpcomingSession,
} from "./types";
import { useAgendaMutation, useSessionLabel } from "./use-agenda";

const linkKey = (l: BookableLink) => `${l.teacherId}:${l.learnerId}`;

/** Agenda du parent ou de l'élève : séances, devoirs, réservation d'un créneau. */
export function FamilyAgenda({
  space,
  data,
  stamp,
}: {
  space: "learner" | "guardian";
  data: FamilyData;
  stamp: number;
}) {
  const t = useTranslations("agenda");
  const label = useSessionLabel();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);

  const book =
    data.bookable.length > 0 ? (
      <Button
        variant="brand"
        onClick={() => {
          setSent(false);
          setOpen(true);
        }}
      >
        <CalendarPlus aria-hidden />
        {t("actions.book")}
      </Button>
    ) : null;

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <CardShell tone="brand" className="xl:order-last">
        <section
          aria-labelledby="upcoming-title"
          className={cn(
            "flex flex-col gap-4 rounded-card border bg-card p-4 sm:p-5",
            CARD_INNER_SHADOW,
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2
              id="upcoming-title"
              className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight"
            >
              <GlowTile tone="yellow" size={28} glyph="60%">
                <CalendarCheck weight="bold" />
              </GlowTile>
              {t("upcoming.title")}
            </h2>
            {data.upcoming.length > 0 ? (
              <span className="rounded-pill bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground tabular-nums">
                {data.upcoming.length}
              </span>
            ) : null}
          </div>
          {sent && (
            <p role="status" className="text-sm text-success-text">
              {t("booking.sent")}
            </p>
          )}
          {data.upcoming.length === 0 ? (
            <EmptyState
              variant="inline"
              illustration={ILLUSTRATION_FOR.welcome}
              title={t("upcoming.empty")}
              description={data.bookable.length > 0 ? t("upcoming.hint") : null}
              action={book}
            />
          ) : (
            <>
              <ul className="flex flex-col gap-2.5">
                {data.upcoming.map((s) => (
                  <li key={s.id}>
                    <UpcomingCard
                      href={sessionHref(space, s.id)}
                      title={label(s, space)}
                      session={s}
                      child={
                        space === "guardian" && s.learnerName
                          ? {
                              id: s.learnerIds[0] ?? s.learnerName,
                              name: s.learnerName,
                            }
                          : null
                      }
                      status={t(`status.${s.status}`)}
                    />
                  </li>
                ))}
              </ul>
              {book ? <div className="flex justify-end">{book}</div> : null}
            </>
          )}
        </section>
      </CardShell>

      <AgendaCalendar space={space} stamp={stamp} />

      <BookingDialog
        space={space}
        links={data.bookable}
        open={open}
        onOpenChange={setOpen}
        onSent={() => setSent(true)}
      />
    </div>
  );
}

/** Une séance à venir : le prof (avatar), l'horaire, l'enfant, l'état. */
function UpcomingCard({
  href,
  title,
  session: s,
  child,
  status,
}: {
  href: string;
  title: string;
  session: UpcomingSession;
  child: { id: string; name: string } | null;
  status: string;
}) {
  return (
    <Link
      href={href}
      className="group/upcoming flex items-start gap-3 rounded-[12px] border bg-card p-3 shadow-[0_1px_2px_rgb(23_23_20/0.05)] outline-none transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-sm focus-visible:ring-[3px] focus-visible:ring-brand/50 motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:shadow-none"
    >
      {s.kind === "group" ? (
        <GlowTile tone="mint" size={40}>
          <UsersThree weight="bold" />
        </GlowTile>
      ) : (
        <PersonAvatar
          name={s.teacherName}
          seed={s.teacherId}
          size="lg"
          decorative
        />
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-start justify-between gap-2">
          <span className="min-w-0 truncate text-sm font-medium">{title}</span>
          <Badge variant={SESSION_BADGE[s.status]} className="shrink-0">
            {status}
          </Badge>
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
          <VideoCamera aria-hidden className="size-3.5 shrink-0" />
          <span className="truncate">
            <LocalDateTime start={s.startsAt} end={s.endsAt} />
          </span>
        </span>
        {child ? (
          <PersonChip
            name={child.name}
            seed={child.id}
            size="sm"
            className="mt-0.5"
          />
        ) : null}
      </span>
    </Link>
  );
}

interface Slot {
  start: string;
  end: string;
}

/**
 * Réserver : choisir le prof (et l'enfant), parcourir les créneaux libres
 * semaine par semaine, en choisir un. La demande attend la réponse du prof.
 */
function BookingDialog({
  space,
  links,
  open,
  onOpenChange,
  onSent,
}: {
  space: "learner" | "guardian";
  links: BookableLink[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent: () => void;
}) {
  const t = useTranslations("agenda");
  const tPay = useTranslations("agenda.payment");
  const tErr = useTranslations("agenda.errors");
  const router = useRouter();
  const ids = { who: useId(), note: useId() };
  const { run, pending, error, setError } = useAgendaMutation();
  const [method, setMethod] = useState<"card" | "mobile_money" | null>(null);
  const [paying, setPaying] = useState(false);
  const [who, setWho] = useState(links[0] ? linkKey(links[0]) : "");
  const [weekStart, setWeekStart] = useState(() => startOfDay(new Date()));
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [chosen, setChosen] = useState<Slot | null>(null);
  const [note, setNote] = useState("");
  const link = links.find((l) => linkKey(l) === who) ?? null;
  // Séance payante : prix fixé par l'équipe Wema pour le pays de l'enfant.
  const price = space === "guardian" ? (link?.price ?? null) : null;
  const priceMethods = price?.methods ?? [];
  const chosenMethod =
    method && priceMethods.includes(method)
      ? method
      : (priceMethods[0] ?? null);

  useEffect(() => {
    if (open) setError(null);
  }, [open, setError]);

  useEffect(() => {
    if (!open || !link) return;
    const controller = new AbortController();
    setSlots(null);
    setFailed(false);
    setChosen(null);
    const params = new URLSearchParams({
      teacherId: link.teacherId,
      learnerId: link.learnerId,
      from: weekStart.toISOString(),
      to: addDays(weekStart, 7).toISOString(),
    });
    fetch(`/api/agenda/slots?${params}`, {
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`créneaux ${res.status}`);
        const body: { slots: Slot[] } = await res.json();
        setSlots(body.slots);
      })
      .catch((e: unknown) => {
        if (!(e instanceof DOMException && e.name === "AbortError"))
          setFailed(true);
      });
    return () => controller.abort();
  }, [open, link, weekStart]);

  const byDay = new Map<string, Slot[]>();
  for (const s of slots ?? []) {
    const key = dayKey(new Date(s.start));
    byDay.set(key, [...(byDay.get(key) ?? []), s]);
  }
  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  const isFirstWeek = weekStart.getTime() <= startOfDay(new Date()).getTime();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!link || !chosen) return;
    const result = await run("POST", "/bookings", {
      teacherId: link.teacherId,
      learnerId: link.learnerId,
      startsAt: chosen.start,
      endsAt: chosen.end,
      note: note.trim() || null,
    });
    if (!result.ok) return;
    const id = read(result.data, "id");
    if (
      read(result.data, "paymentRequired") === true &&
      typeof id === "string"
    ) {
      // La séance attend son paiement : on enchaîne, sinon on ouvre sa page pour réessayer.
      const href = sessionHref(space, id);
      if (!chosenMethod) {
        router.push(href);
        return;
      }
      setPaying(true);
      const paid = await startSessionCheckout(id, chosenMethod, (q) =>
        router.push(`${href}${q}`),
      );
      setPaying(false);
      if (!paid.ok) {
        setError(tErr.has(paid.code) ? tErr(paid.code) : tErr("generic"));
        router.push(href);
      }
      return;
    }
    setNote("");
    setChosen(null);
    onOpenChange(false);
    onSent();
  }

  const single = links.length === 1 ? links[0] : undefined;
  const linkTitle = (l: BookableLink) =>
    space === "guardian"
      ? t("booking.linkTitleChild", {
          child: l.learnerName,
          teacher: l.teacherName,
        })
      : l.teacherName;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <form onSubmit={submit} className="flex min-w-0 flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t("booking.title")}</DialogTitle>
            <DialogDescription>
              {t(space === "learner" ? "booking.hintLearner" : "booking.hint")}
            </DialogDescription>
          </DialogHeader>

          {links.length > 1 ? (
            <FieldSection
              title={t("booking.who")}
              icon={
                <GlowTile tone="sky" size={32} glyph="60%">
                  <ChalkboardTeacher weight="fill" />
                </GlowTile>
              }
            >
              {links.length < 7 ? (
                <ChoiceCards
                  aria-label={t("booking.who")}
                  size="compact"
                  columns={links.length > 2 ? 2 : 1}
                  value={who}
                  onValueChange={setWho}
                  options={links.map((l) => ({
                    value: linkKey(l),
                    title: linkTitle(l),
                    description: l.className,
                    media: (
                      <PersonAvatar
                        name={l.teacherName}
                        seed={l.teacherId}
                        decorative
                      />
                    ),
                  }))}
                />
              ) : (
                <Field>
                  <FieldLabel htmlFor={ids.who} className="sr-only">
                    {t("booking.who")}
                  </FieldLabel>
                  <NativeSelect
                    id={ids.who}
                    value={who}
                    onChange={(e) => setWho(e.target.value)}
                  >
                    {links.map((l) => (
                      <NativeSelectOption key={linkKey(l)} value={linkKey(l)}>
                        {space === "guardian"
                          ? t("booking.linkOptionChild", {
                              child: l.learnerName,
                              teacher: l.teacherName,
                              className: l.className,
                            })
                          : t("booking.linkOption", {
                              teacher: l.teacherName,
                              className: l.className,
                            })}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              )}
            </FieldSection>
          ) : null}

          <FieldSection
            title={t("booking.slots")}
            description={
              single ? (
                <PersonChip
                  name={single.teacherName}
                  seed={single.teacherId}
                  size="sm"
                  meta={
                    space === "guardian"
                      ? `${single.learnerName} · ${single.className}`
                      : single.className
                  }
                />
              ) : null
            }
            icon={
              <GlowTile tone="yellow" size={32} glyph="60%">
                <CalendarBlank weight="fill" />
              </GlowTile>
            }
            className="gap-4"
          >
            <div className="flex items-center justify-between gap-2 rounded-control border bg-muted/50 p-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={isFirstWeek}
                aria-label={t("booking.prevWeek")}
                onClick={() => setWeekStart(addDays(weekStart, -7))}
              >
                <CaretLeft aria-hidden />
              </Button>
              <p className="text-sm font-medium tabular-nums">
                {t("booking.week", {
                  from: weekStart.toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "short",
                  }),
                  to: addDays(weekStart, 6).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "short",
                  }),
                })}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t("booking.nextWeek")}
                onClick={() => setWeekStart(addDays(weekStart, 7))}
              >
                <CaretRight aria-hidden />
              </Button>
            </div>

            <div className="flex flex-col gap-3" aria-live="polite">
              {failed ? (
                <p role="alert" className="text-sm">
                  {t("loadError")}
                </p>
              ) : slots === null ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner aria-hidden className="size-4" />
                  {t("booking.loading")}
                </p>
              ) : slots.length === 0 ? (
                <p className="rounded-control border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
                  {t("booking.noSlots")}
                </p>
              ) : (
                [...byDay].map(([key, list]) => (
                  <div key={key} className="flex flex-col gap-1.5">
                    <p className="font-mono text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                      {new Date(list[0]?.start ?? key).toLocaleDateString(
                        "fr-FR",
                        { weekday: "long", day: "numeric", month: "long" },
                      )}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {list.map((s) => (
                        <button
                          key={s.start}
                          type="button"
                          aria-pressed={chosen?.start === s.start}
                          // Lu en entier par un lecteur d'écran : le jour, pas seulement l'heure.
                          aria-label={t("booking.slotLabel", {
                            day: new Date(s.start).toLocaleDateString("fr-FR", {
                              weekday: "long",
                              day: "numeric",
                              month: "long",
                            }),
                            start: time(s.start),
                            end: time(s.end),
                          })}
                          onClick={() => setChosen(s)}
                          className={SLOT_CLASS}
                        >
                          {time(s.start)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            {chosen && (
              <p className="flex flex-wrap items-center gap-x-1.5 rounded-control bg-brand-subtle px-3 py-2 text-sm">
                <CheckCircle
                  aria-hidden
                  weight="fill"
                  className="size-4 shrink-0 text-brand-text dark:text-brand"
                />
                {t("booking.chosen")}
                <strong className="font-medium">
                  <LocalDateTime start={chosen.start} end={chosen.end} long />
                </strong>
              </p>
            )}

            <Field>
              <FieldLabel htmlFor={ids.note}>{t("booking.note")}</FieldLabel>
              <Textarea
                id={ids.note}
                value={note}
                maxLength={500}
                rows={3}
                placeholder={t(
                  space === "learner"
                    ? "booking.notePlaceholderLearner"
                    : "booking.notePlaceholder",
                )}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
          </FieldSection>

          {price && (
            <FieldSection
              data-testid="booking-price"
              tone="brand"
              title={tPay("price", {
                amount: formatAmount(price.amountMinor, price.currency),
              })}
              description={
                priceMethods.length > 0 ? tPay("priceHint") : tPay("noMethod")
              }
              icon={
                <GlowTile tone="amber" size={32} glyph="60%">
                  <CreditCard weight="fill" />
                </GlowTile>
              }
            >
              {priceMethods.length > 1 ? (
                <MethodSelect
                  methods={priceMethods}
                  value={chosenMethod}
                  onChange={setMethod}
                />
              ) : null}
            </FieldSection>
          )}

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("actions.close")}
            </Button>
            <Button
              type="submit"
              variant="brand"
              disabled={
                pending ||
                paying ||
                !chosen ||
                (price !== null && chosenMethod === null)
              }
            >
              {pending || paying
                ? t("actions.saving")
                : price
                  ? tPay("submit")
                  : t("booking.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Créneau en relief : pastille blanche, jaune une fois choisie. */
const SLOT_CLASS =
  "min-w-16 rounded-[10px] border border-border bg-card px-3 py-1.5 text-sm font-medium tabular-nums shadow-[0_1px_2px_rgb(23_23_20/0.06)] outline-none transition-[transform,border-color,background-color] duration-150 hover:-translate-y-px hover:border-foreground/25 focus-visible:ring-[3px] focus-visible:ring-brand/50 motion-reduce:transition-none motion-reduce:hover:translate-y-0 aria-pressed:border-brand-active aria-pressed:bg-brand aria-pressed:text-ink-on-brand dark:shadow-none";
