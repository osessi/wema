/**
 * Séance supplémentaire payante : règles d'argent, sans base de données.
 *
 * - Le prix vient du pays des programmes de l'enfant, saisi par l'équipe Wema.
 *   Aucun prix pour ces pays : la séance reste gratuite (comme avant).
 * - Plusieurs pays avec un prix : celui du premier pays par ordre alphabétique,
 *   pour que la règle reste la même d'une réservation à l'autre.
 * - Seule une réservation faite par le parent est payante ; un élève qui
 *   réserve lui-même ne paie rien ici.
 */
export function sessionPriceFor<
  P extends { countryId: string; countryName: string },
>(
  prices: readonly P[],
  learnerCountryIds: readonly string[],
  via: "guardian" | "self",
): P | null {
  if (via !== "guardian") return null;
  const own = new Set(learnerCountryIds);
  return (
    prices
      .filter((p) => own.has(p.countryId))
      .sort((a, b) => a.countryName.localeCompare(b.countryName, "fr"))[0] ??
    null
  );
}

/** Une séance avec un montant dû n'est confirmée qu'une fois payée. */
export function canBeConfirmed(
  charge: { paidAt: Date | null } | null,
): boolean {
  return charge === null || charge.paidAt !== null;
}

/** Le parent peut lancer le paiement : montant dû, pas encore payé, séance à venir et en attente. */
export function canPay(input: {
  charge: { paidAt: Date | null } | null;
  status: string;
  endsAt: Date;
  now: Date;
}): boolean {
  return (
    input.charge !== null &&
    input.charge.paidAt === null &&
    (input.status === "requested" || input.status === "proposed") &&
    input.endsAt.getTime() > input.now.getTime()
  );
}
