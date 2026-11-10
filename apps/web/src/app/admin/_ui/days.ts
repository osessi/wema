/** Complète une série quotidienne avec les jours sans appel, à zéro. */
export function fillDays<
  D extends { day: string; costUsd: number; calls: number },
>(days: readonly D[]): { day: string; costUsd: number; calls: number }[] {
  if (days.length === 0) return [];
  const byDay = new Map(days.map((d) => [d.day, d]));
  const sorted = [...days].sort((a, b) => a.day.localeCompare(b.day));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (!first || !last) return [];
  const out: { day: string; costUsd: number; calls: number }[] = [];
  const end = new Date(`${last.day}T12:00:00Z`).getTime();
  for (
    let at = new Date(`${first.day}T12:00:00Z`).getTime();
    at <= end;
    at += 86_400_000
  ) {
    const day = new Date(at).toISOString().slice(0, 10);
    const d = byDay.get(day);
    out.push({ day, costUsd: d?.costUsd ?? 0, calls: d?.calls ?? 0 });
  }
  return out;
}

/** Montant en dollars : 4 décimales sous 1 $, 2 au-delà. */
export function usdOptions(n: number): Intl.NumberFormatOptions {
  return {
    style: "currency",
    currency: "USD",
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: n !== 0 && Math.abs(n) < 1 ? 4 : 2,
  };
}

/** Montant en dollars formaté en fr-FR (« 0,0333 $ »). */
export function formatUsd(n: number): string {
  return new Intl.NumberFormat("fr-FR", usdOptions(n)).format(n);
}
