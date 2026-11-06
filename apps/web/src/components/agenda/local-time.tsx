"use client";

import { useMounted } from "./use-agenda";

/**
 * Date et heures d'une séance dans le fuseau de l'appareil. Rien n'est écrit
 * côté serveur (son fuseau n'est pas celui de la personne qui lit).
 */
export function LocalDateTime({
  start,
  end,
  long = false,
}: {
  start: string;
  end?: string;
  long?: boolean;
}) {
  const mounted = useMounted();
  if (!mounted) return <span className="inline-block min-w-32">&nbsp;</span>;
  const from = new Date(start);
  const day = from.toLocaleDateString(undefined, {
    weekday: long ? "long" : "short",
    day: "numeric",
    month: long ? "long" : "short",
    ...(long ? { year: "numeric" } : {}),
  });
  const time = (d: Date) =>
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return (
    <time dateTime={start} className="first-letter:uppercase">
      {day} · {time(from)}
      {end ? ` – ${time(new Date(end))}` : ""}
    </time>
  );
}
