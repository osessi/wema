import type {
  AccessSource,
  PaymentMethod,
  PaymentProviderName,
} from "@wema/db";
import type { LearnerId, Result, SubjectId } from "@wema/domain";
import type { KkiapayClient } from "./kkiapay";

/**
 * Paiement en ligne (fiche de décision 0009). Chaque fournisseur est un
 * adaptateur HTTP (fetch, sans SDK) : Stripe pour la carte, Kkiapay pour le
 * Mobile Money. Sans clé, hors production, un faux fournisseur simule un
 * paiement réussi.
 */

/** fetch injectable (simulé dans les tests). */
export type Fetch = (
  input: string,
  init: { method: string; headers: Record<string, string>; body?: string },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export type ProviderError = {
  kind: "provider_failed";
  /** Code court, sans donnée personnelle ni message brut du fournisseur. */
  reason: string;
};

export interface StartInput {
  paymentId: string;
  amountMinor: number;
  currency: string;
  intervalMonths: number;
  /** Paiement unique (séance), sans abonnement chez le fournisseur. */
  oneTime?: boolean;
  /** Libellé lisible : matière et élève (prénom affiché seulement). */
  description: string;
  /** Page de retour après paiement (le paiement y est confirmé). */
  returnUrl: string;
  /** Page de retour si le parent abandonne. */
  cancelUrl: string;
}

/** Suite du parcours dans le navigateur. */
export type StartResult =
  | { kind: "redirect"; url: string; externalId: string | null }
  | {
      kind: "kkiapay";
      publicKey: string;
      sandbox: boolean;
      amount: number;
      reference: string;
    };

export interface Verification {
  status: "succeeded" | "pending" | "failed";
  /** Référence du paiement chez le fournisseur (session, transaction). */
  externalId: string | null;
  /** Abonnement récurrent chez le fournisseur (Stripe), sinon null. */
  externalSubscriptionId: string | null;
}

export interface PaymentProvider {
  readonly name: PaymentProviderName;
  start(input: StartInput): Promise<Result<StartResult, ProviderError>>;
  /** Demande au fournisseur où en est un paiement (retour du parent, webhook). */
  verify(payment: {
    id: string;
    externalId: string | null;
    amountMinor: number;
    currency: string;
    /** Transaction annoncée par le navigateur (Kkiapay), à vérifier. */
    transactionId?: string;
  }): Promise<Result<Verification, ProviderError>>;
  /** Arrête le renouvellement à l'échéance (abonnement récurrent). */
  cancelAtPeriodEnd?(
    externalSubscriptionId: string,
  ): Promise<Result<void, ProviderError>>;
}

/** Pourquoi un élève a accès à une matière (null : pas d'accès). */
export interface AccessPolicy {
  subjectAccess(
    learnerId: LearnerId,
    subjectId: SubjectId,
    now: Date,
  ): Promise<AccessSource | "open" | null>;
}

export interface BillingDeps {
  /** Fournisseur par moyen de paiement ; absent : moyen indisponible. */
  providers: Partial<Record<PaymentMethod, PaymentProvider>>;
  /** Secret de signature des webhooks Stripe (whsec_…). */
  stripeWebhookSecret: string | null;
  /** Secret partagé des webhooks Kkiapay, et le vérificateur de transactions. */
  kkiapayWebhookSecret: string | null;
  kkiapay: KkiapayClient | null;
  /** Droits d'accès aux matières. */
  access: AccessPolicy;
}
