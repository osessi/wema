import { ok } from "@wema/domain";
import type { PaymentProvider } from "./types";

/**
 * Faux fournisseur de développement (jamais en production) : renvoie tout de
 * suite vers la page de retour, où le paiement est déclaré réussi. Il permet
 * de tester tout le parcours sans compte Stripe ni Kkiapay.
 */
export function createDevProvider(): PaymentProvider {
  return {
    name: "dev",
    async start(input) {
      return ok({
        kind: "redirect",
        url: input.returnUrl,
        externalId: `dev_${input.paymentId}`,
      });
    },
    async verify(payment) {
      return ok({
        status: "succeeded",
        externalId: payment.externalId ?? `dev_${payment.id}`,
        externalSubscriptionId: null,
      });
    },
    async cancelAtPeriodEnd() {
      return ok(undefined);
    },
  };
}
