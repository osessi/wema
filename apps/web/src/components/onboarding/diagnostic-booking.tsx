"use client";

import { CalendarCheck, CheckCircle, VideoCamera } from "@phosphor-icons/react";
import { Alert, AlertDescription } from "@wema/ui/components/ui/alert";
import { Button } from "@wema/ui/components/ui/button";
import { toast } from "@wema/ui/components/ui/sonner";
import { Spinner } from "@wema/ui/components/ui/spinner";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@wema/ui/components/ui/toggle-group";
import { ConfirmDialog } from "@wema/ui/components/wema/confirm-dialog";
import { PersonAvatar } from "@wema/ui/components/wema/person-avatar";
import { cn } from "@wema/ui/lib/utils";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { mutate, read } from "../../lib/mutate";
import type { ChildDiagnostic } from "../../lib/onboarding-types";
import { LocalDateTime } from "../agenda/local-time";

/** Créneau en relief : pastille blanche, jaune une fois choisie. */
const SLOT_CLASS =
  "h-auto min-w-16 rounded-[10px] border border-border bg-card px-3 py-1.5 text-sm font-medium tabular-nums shadow-[0_1px_2px_rgb(23_23_20/0.06)] transition-[transform,border-color,background-color] duration-150 hover:-translate-y-px hover:border-foreground/25 hover:bg-card focus-visible:ring-[3px] focus-visible:ring-brand/50 motion-reduce:transition-none motion-reduce:hover:translate-y-0 data-[state=on]:border-brand-active data-[state=on]:bg-brand data-[state=on]:text-ink-on-brand dark:shadow-none";

/** Fenêtre de recherche des créneaux. */
const SEARCH_DAYS = 14;
const KNOWN = [
  "slot_unavailable",
  "learner_busy",
  "not_eligible",
  "already_booked",
] as const;

interface Slot {
  start: string;
  end: string;
}

const dayOf = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

/**
 * Rendez-vous de diagnostic d'un enfant, côté parent : état, réservation d'un
 * créneau parmi les disponibilités des conseillers, visio et annulation.
 */
export function DiagnosticBooking({ child }: { child: ChildDiagnostic }) {
  const t = useTranslations("onboarding.diagnostic");
  const router = useRouter();
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [chosen, setChosen] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const appointment = child.appointment;

  const errorText = (code: string) => {
    const known = KNOWN.find((k) => k === code);
    return known ? t(`errors.${known}`) : t("errors.generic");
  };

  async function search() {
    setLoading(true);
    setError(null);
    const from = new Date();
    const to = new Date(from.getTime() + SEARCH_DAYS * 86_400_000);
    const query = new URLSearchParams({
      learnerId: child.learnerId,
      from: from.toISOString(),
      to: to.toISOString(),
    });
    try {
      const res = await fetch(`/api/diagnostic/slots?${query}`, {
        credentials: "same-origin",
      });
      const data: unknown = await res.json();
      const list = read(data, "slots");
      if (!res.ok || !Array.isArray(list)) {
        setError(errorText(String(read(read(data, "error"), "code"))));
        setSlots([]);
      } else {
        setSlots(
          list.flatMap((s) => {
            const start = read(s, "start");
            const end = read(s, "end");
            return typeof start === "string" && typeof end === "string"
              ? [{ start, end }]
              : [];
          }),
        );
      }
    } catch {
      setError(t("errors.generic"));
    }
    setLoading(false);
  }

  async function book() {
    if (!chosen) return;
    setPending(true);
    const result = await mutate("POST", "/diagnostic/bookings", {
      learnerId: child.learnerId,
      startsAt: chosen,
    });
    setPending(false);
    if (!result.ok) {
      setError(errorText(result.code));
      if (result.code === "slot_unavailable") void search();
      return;
    }
    toast.success(t("bookedToast"));
    setSlots(null);
    router.refresh();
  }

  if (appointment?.status === "done")
    return (
      <p className="flex items-center gap-2 text-sm text-success-text">
        <CheckCircle aria-hidden weight="fill" />
        {t("done")}
      </p>
    );

  if (appointment?.status === "booked")
    return (
      <div
        className={cn(
          "flex flex-col gap-4 rounded-card border bg-card p-4 sm:flex-row sm:items-center",
          "shadow-[0_1px_2px_rgb(23_23_20/0.05)] dark:shadow-none",
        )}
      >
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <PersonAvatar
            name={appointment.advisorName}
            seed={appointment.advisorName}
            size="lg"
            decorative
          />
          <p className="flex min-w-0 flex-col gap-0.5 text-sm">
            <span>{t("booked", { advisor: appointment.advisorName })}</span>
            <strong className="flex items-center gap-1.5 font-medium">
              <CalendarCheck
                aria-hidden
                weight="bold"
                className="size-4 shrink-0 text-muted-foreground"
              />
              <LocalDateTime
                start={appointment.startsAt}
                end={appointment.endsAt}
                long
              />
            </strong>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {appointment.visioUrl ? (
            <Button asChild variant="outline" size="sm">
              <a href={appointment.visioUrl} target="_blank" rel="noreferrer">
                <VideoCamera aria-hidden />
                {t("join")}
              </a>
            </Button>
          ) : null}
          <ConfirmDialog
            trigger={
              <Button variant="ghost" size="sm">
                {t("cancel")}
              </Button>
            }
            title={t("cancelTitle")}
            description={t("cancelText")}
            variant="destructive"
            onConfirm={async () => {
              const result = await mutate(
                "POST",
                `/diagnostic/${appointment.id}/cancel`,
              );
              if (!result.ok) return false;
              router.refresh();
              return true;
            }}
          />
        </div>
      </div>
    );

  if (!child.eligibility.eligible)
    return <p className="text-sm text-muted-foreground">{t("notEligible")}</p>;

  // Créneaux regroupés par jour.
  const days = new Map<string, Slot[]>();
  for (const s of slots ?? []) {
    const key = dayOf(s.start);
    days.set(key, [...(days.get(key) ?? []), s]);
  }

  return (
    <div className="flex flex-col gap-4">
      {slots === null ? (
        <Button
          variant="brand"
          className="self-start"
          onClick={search}
          disabled={loading}
        >
          {loading ? <Spinner /> : <CalendarCheck aria-hidden weight="bold" />}
          {t("book")}
        </Button>
      ) : slots.length === 0 ? (
        error ? null : (
          <p className="rounded-control border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
            {t("noSlots")}
          </p>
        )
      ) : (
        <div className="flex flex-col gap-3">
          <p
            className="flex items-center gap-2 text-sm font-medium"
            id={`slots-${child.learnerId}`}
          >
            {t("slotsLabel", { name: child.displayName })}
          </p>
          <fieldset
            className="flex max-h-80 min-w-0 flex-col gap-3 overflow-y-auto rounded-card border bg-muted/40 p-3"
            aria-labelledby={`slots-${child.learnerId}`}
          >
            {[...days.entries()].map(([day, list]) => (
              <div key={day} className="flex flex-col gap-1.5">
                <p className="font-mono text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                  {day}
                </p>
                <ToggleGroup
                  type="single"
                  spacing={1.5}
                  value={chosen}
                  onValueChange={setChosen}
                  className="flex-wrap justify-start"
                  aria-label={day}
                >
                  {list.map((s) => (
                    <ToggleGroupItem
                      key={s.start}
                      value={s.start}
                      className={SLOT_CLASS}
                    >
                      {timeOf(s.start)}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
            ))}
          </fieldset>
          <Button
            variant="brand"
            className="self-start"
            disabled={!chosen || pending}
            onClick={book}
          >
            {pending ? <Spinner /> : null}
            {t("confirm")}
          </Button>
        </div>
      )}
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
