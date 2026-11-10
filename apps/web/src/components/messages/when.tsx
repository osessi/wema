"use client";

import { useFormatter, useNow } from "next-intl";

/** Horodatage court : l'heure aujourd'hui, la date sinon. */
export function When({ at, className }: { at: string; className?: string }) {
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const date = new Date(at);
  const today = date.toDateString() === now.toDateString();
  return (
    <time dateTime={at} className={className}>
      {today
        ? format.dateTime(date, { hour: "2-digit", minute: "2-digit" })
        : format.dateTime(date, {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
    </time>
  );
}
