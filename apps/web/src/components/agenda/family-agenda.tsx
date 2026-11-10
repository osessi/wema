"use client";

import { CalendarPlus, CaretLeft, CaretRight } from "@phosphor-icons/react";
import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@wema/ui/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@wema/ui/components/ui/dialog";
import { Label } from "@wema/ui/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@wema/ui/components/ui/native-select";
import { Textarea } from "@wema/ui/components/ui/textarea";
import { cn } from "@wema/ui/lib/utils";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { type FormEvent, useEffect, useId, useState } from "react";
import { AgendaCalendar } from "./calendar";
import { addDays, dayKey, startOfDay } from "./dates";
import { LocalDateTime } from "./local-time";
import { type BookableLink, type FamilyData, sessionHref } from "./types";
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

  return (
    <div className="space-y-6">
      {data.bookable.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={() => {
              setSent(false);
              setOpen(true);
            }}
          >
            <CalendarPlus aria-hidden />
            {t("actions.book")}
          </Button>
          {sent && (
            <p role="status" className="text-sm text-muted-foreground">
              {t("booking.sent")}
            </p>
          )}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("upcoming.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {data.upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("upcoming.empty")}
            </p>
          ) : (
            <ul className="divide-y">
              {data.upcoming.map((s) => (
                <li key={s.id} className="py-3 first:pt-0 last:pb-0">
                  <Link
                    href={sessionHref(space, s.id)}
                    className="flex flex-wrap items-center justify-between gap-2 hover:underline"
                  >
                    <span className="min-w-0 space-y-0.5">
                      <span className="block font-medium">
                        {label(s, space)}
                        {space === "guardian" && s.learnerName
                          ? ` · ${s.learnerName}`
                          : ""}
                      </span>
                      <span className="block text-sm text-muted-foreground">
                        <LocalDateTime start={s.startsAt} end={s.endsAt} />
                      </span>
                    </span>
                    <Badge
                      variant={
                        s.status === "confirmed" ? "secondary" : "outline"
                      }
                    >
                      {t(`status.${s.status}`)}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

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
  const ids = { who: useId(), note: useId() };
  const { run, pending, error, setError } = useAgendaMutation();
  const [who, setWho] = useState(links[0] ? linkKey(links[0]) : "");
  const [weekStart, setWeekStart] = useState(() => startOfDay(new Date()));
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [chosen, setChosen] = useState<Slot | null>(null);
  const [note, setNote] = useState("");
  const link = links.find((l) => linkKey(l) === who) ?? null;

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
    if (result.ok) {
      setNote("");
      setChosen(null);
      onOpenChange(false);
      onSent();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t("booking.title")}</DialogTitle>
            <DialogDescription>
              {t(space === "learner" ? "booking.hintLearner" : "booking.hint")}
            </DialogDescription>
          </DialogHeader>
          {links.length > 1 && (
            <div className="space-y-2">
              <Label htmlFor={ids.who}>{t("booking.who")}</Label>
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
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              disabled={isFirstWeek}
              aria-label={t("booking.prevWeek")}
              onClick={() => setWeekStart(addDays(weekStart, -7))}
            >
              <CaretLeft aria-hidden />
            </Button>
            <p className="text-sm font-medium">
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
              variant="outline"
              size="icon-sm"
              aria-label={t("booking.nextWeek")}
              onClick={() => setWeekStart(addDays(weekStart, 7))}
            >
              <CaretRight aria-hidden />
            </Button>
          </div>

          <div className="space-y-3" aria-live="polite">
            {failed ? (
              <p role="alert" className="text-sm">
                {t("loadError")}
              </p>
            ) : slots === null ? (
              <p className="text-sm text-muted-foreground">
                {t("booking.loading")}
              </p>
            ) : slots.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("booking.noSlots")}
              </p>
            ) : (
              [...byDay].map(([key, list]) => (
                <div key={key} className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground first-letter:uppercase">
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
                        className={cn(
                          "rounded-md border px-2.5 py-1 text-sm tabular-nums transition-colors hover:bg-secondary",
                          chosen?.start === s.start &&
                            "border-primary bg-primary text-primary-foreground hover:bg-primary",
                        )}
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
            <p className="text-sm">
              {t("booking.chosen")}
              <LocalDateTime start={chosen.start} end={chosen.end} long />
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor={ids.note}>{t("booking.note")}</Label>
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
          </div>

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
            <Button type="submit" disabled={pending || !chosen}>
              {pending ? t("actions.saving") : t("booking.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
