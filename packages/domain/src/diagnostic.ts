// Rendez-vous de diagnostic avec un conseiller Wema, après le paiement.
// Il est inclus dans l'abonnement : aucun prix n'est attaché ici.

/** Durée d'un rendez-vous de diagnostic, en minutes (à confirmer par Olivier). */
export const DIAGNOSTIC_MINUTES = 15;

/** booked : prévu ; cancelled : annulé (on peut en reprendre un) ; done : compte rendu publié. */
export type DiagnosticStatus = "booked" | "cancelled" | "done";

export type DiagnosticIneligibility =
  | "no_paid_subscription"
  | "already_booked"
  | "already_done";

export type DiagnosticEligibility =
  | { eligible: true }
  | { eligible: false; reason: DiagnosticIneligibility };

/** Statuts d'abonnement d'une période payée (l'essai n'en est pas une). */
const PAID_STATUSES: readonly string[] = ["active", "past_due", "canceled"];

/**
 * Un élève peut réserver son rendez-vous de diagnostic s'il a une période
 * payée en cours (un essai ne suffit pas : le diagnostic vient après le
 * paiement) et s'il n'en a pas déjà un, prévu ou fait. Un rendez-vous annulé
 * ne compte pas.
 */
export function diagnosticEligibility(input: {
  subscriptions: readonly {
    status: string;
    currentPeriodEnd: Date | null;
  }[];
  appointments: readonly { status: DiagnosticStatus }[];
  now: Date;
}): DiagnosticEligibility {
  if (input.appointments.some((a) => a.status === "done"))
    return { eligible: false, reason: "already_done" };
  if (input.appointments.some((a) => a.status === "booked"))
    return { eligible: false, reason: "already_booked" };
  const paid = input.subscriptions.some(
    (s) =>
      PAID_STATUSES.includes(s.status) &&
      s.currentPeriodEnd !== null &&
      s.currentPeriodEnd.getTime() > input.now.getTime(),
  );
  return paid
    ? { eligible: true }
    : { eligible: false, reason: "no_paid_subscription" };
}
