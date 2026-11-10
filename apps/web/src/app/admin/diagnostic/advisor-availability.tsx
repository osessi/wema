"use client";

import { Plus, Trash } from "@phosphor-icons/react";
import { Button } from "@wema/ui/components/ui/button";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { AvailabilityDialog } from "../../../components/agenda/teacher-dialogs";
import { useAgendaMutation } from "../../../components/agenda/use-agenda";
import type { AdvisorOverview } from "../../../lib/onboarding-types";

const clock = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/** Disponibilités du conseiller : celles de son agenda (même API, mêmes règles). */
export function AdvisorAvailability({
  rules,
}: {
  rules: AdvisorOverview["rules"];
}) {
  const t = useTranslations("diagnostic.availability");
  const days: string[] = useTranslations("agenda").raw("weekdaysShort");
  const [open, setOpen] = useState(false);
  const { run, pending, error } = useAgendaMutation();
  return (
    <div className="flex flex-col gap-3">
      {rules.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-card border">
          {rules.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm"
            >
              <span>
                {t("rule", {
                  days: r.weekdays.map((d) => days[d - 1] ?? "").join(", "),
                  start: clock(r.startMinute),
                  end: clock(r.endMinute),
                })}
                <span className="text-muted-foreground"> · {r.timeZone}</span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => run("DELETE", `/availability/${r.id}`)}
              >
                <Trash aria-hidden />
                {t("remove")}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {error ? <p className="text-sm text-danger-text">{error}</p> : null}
      <Button
        variant="outline"
        className="self-start"
        onClick={() => setOpen(true)}
      >
        <Plus aria-hidden />
        {t("add")}
      </Button>
      <AvailabilityDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
