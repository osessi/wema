import type { PaymentProviderName } from "@wema/db";

/** Événement de facturation, une fois le message du fournisseur authentifié et lu. */
export type BillingEvent =
  | {
      kind: "payment_succeeded";
      paymentId: string;
      externalId: string;
      externalSubscriptionId: string | null;
    }
  | { kind: "payment_failed"; paymentId: string }
  | {
      kind: "renewal_paid";
      provider: PaymentProviderName;
      externalSubscriptionId: string;
      externalId: string;
      amountMinor: number;
      currency: string;
      periodEnd: Date | null;
    }
  | {
      kind: "renewal_failed";
      provider: PaymentProviderName;
      externalSubscriptionId: string;
    }
  | {
      kind: "subscription_ended";
      provider: PaymentProviderName;
      externalSubscriptionId: string;
    }
  | { kind: "ignored" };
