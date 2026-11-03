/**
 * Montant lisible à partir de la plus petite unité de la devise : le nombre
 * de décimales vient de la devise elle-même (Intl), jamais d'une liste figée.
 */
export function formatAmount(amountMinor: number, currency: string): string {
  const format = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
  });
  const digits = format.resolvedOptions().maximumFractionDigits ?? 2;
  return format.format(amountMinor / 10 ** digits);
}

export function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(
    new Date(iso),
  );
}
