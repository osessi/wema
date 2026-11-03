import { createBillingStore, type SqlExecutor } from "@wema/db";
import type { BillingEvent } from "./events";

export type ApplyOutcome =
  | "applied"
  | "already_applied"
  | "unknown"
  | "ignored";

/**
 * Applique un événement de facturation authentifié. Chaque cas est idempotent :
 * un paiement réussi ou une facture ne comptent qu'une fois, même si le
 * fournisseur renvoie le même message.
 */
export async function applyBillingEvent(
  db: SqlExecutor,
  event: BillingEvent,
  now: Date,
): Promise<ApplyOutcome> {
  const billing = createBillingStore(db);
  switch (event.kind) {
    case "payment_succeeded": {
      const payment = await billing.getPayment(event.paymentId);
      if (!payment) return "unknown";
      const result = await billing.applyPaymentSuccess({
        paymentId: payment.id,
        externalId: event.externalId,
        externalSubscriptionId: event.externalSubscriptionId,
        now,
      });
      return result.applied ? "applied" : "already_applied";
    }
    case "payment_failed": {
      const payment = await billing.getPayment(event.paymentId);
      if (!payment) return "unknown";
      return (await billing.markPaymentFailed(payment.id))
        ? "applied"
        : "already_applied";
    }
    case "renewal_paid": {
      const subscription = await billing.subscriptionByExternal(
        event.provider,
        event.externalSubscriptionId,
      );
      if (!subscription) return "unknown";
      return (await billing.applyRenewal({
        subscription,
        externalId: event.externalId,
        amountMinor: event.amountMinor,
        currency: event.currency,
        periodEnd: event.periodEnd,
        now,
      }))
        ? "applied"
        : "already_applied";
    }
    case "renewal_failed": {
      const subscription = await billing.subscriptionByExternal(
        event.provider,
        event.externalSubscriptionId,
      );
      if (!subscription) return "unknown";
      if (subscription.status !== "active") return "already_applied";
      // L'accès reste ouvert jusqu'à l'échéance déjà payée.
      await billing.setSubscriptionStatus(subscription.id, "past_due", now);
      return "applied";
    }
    case "subscription_ended": {
      const subscription = await billing.subscriptionByExternal(
        event.provider,
        event.externalSubscriptionId,
      );
      if (!subscription) return "unknown";
      if (subscription.status === "ended") return "already_applied";
      // Fin chez le fournisseur : l'accès est coupé tout de suite.
      await billing.setSubscriptionStatus(subscription.id, "ended", now, {
        periodEnd:
          subscription.currentPeriodEnd && subscription.currentPeriodEnd < now
            ? subscription.currentPeriodEnd
            : now,
      });
      return "applied";
    }
    case "ignored":
      return "ignored";
  }
}
