import { timingSafeEqual } from "node:crypto";
import { err, ok, type Result } from "@wema/domain";
import { pickNumber, pickString } from "./json";
import type { Fetch, PaymentProvider, ProviderError } from "./types";

// Kkiapay (Mobile Money et carte), par son API HTTP : le paiement se fait dans
// le widget Kkiapay ouvert par le navigateur (clé publique) ; le serveur ne
// croit jamais le navigateur ni le corps d'un webhook et redemande l'état de
// la transaction à Kkiapay (clés privée et secrète), avant d'ouvrir l'accès.

export interface KkiapayConfig {
  publicKey: string;
  privateKey: string;
  secretKey: string;
  sandbox: boolean;
  baseUrl?: string;
}

/** Devises acceptées par Kkiapay (contrainte du fournisseur, pas d'un pays). */
export const KKIAPAY_CURRENCIES: readonly string[] = ["XOF"];

export interface KkiapayTransaction {
  transactionId: string;
  status: "succeeded" | "pending" | "failed";
  amount: number | null;
  /** Référence Wema transmise au widget (identifiant du paiement), si renvoyée. */
  reference: string | null;
}

export interface KkiapayClient extends PaymentProvider {
  transaction(
    transactionId: string,
  ): Promise<Result<KkiapayTransaction, ProviderError>>;
}

const failure = (reason: string): ProviderError => ({
  kind: "provider_failed",
  reason,
});

export function createKkiapayProvider(
  config: KkiapayConfig,
  fetcher: Fetch = fetch,
): KkiapayClient {
  const base =
    config.baseUrl ??
    (config.sandbox
      ? "https://api-sandbox.kkiapay.me"
      : "https://api.kkiapay.me");

  const transaction: KkiapayClient["transaction"] = async (transactionId) => {
    let status: number;
    let json: unknown;
    try {
      const res = await fetcher(`${base}/api/v1/transactions/status`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "x-api-key": config.publicKey,
          "x-private-key": config.privateKey,
          "x-secret-key": config.secretKey,
        },
        body: JSON.stringify({ transactionId }),
      });
      status = res.status;
      json = await res.json().catch(() => null);
    } catch {
      return err(failure("kkiapay_unreachable"));
    }
    if (status >= 300) return err(failure(`kkiapay_${status}`));
    const state = (pickString(json, "status") ?? "").toUpperCase();
    return ok({
      transactionId,
      status:
        state === "SUCCESS"
          ? "succeeded"
          : state === "FAILED"
            ? "failed"
            : "pending",
      amount: pickNumber(json, "amount") ?? null,
      reference: pickString(json, "partnerId") ?? null,
    });
  };

  return {
    name: "kkiapay",
    transaction,
    async start(input) {
      if (!KKIAPAY_CURRENCIES.includes(input.currency))
        return err(failure("currency_unsupported"));
      return ok({
        kind: "kkiapay",
        publicKey: config.publicKey,
        sandbox: config.sandbox,
        amount: input.amountMinor,
        reference: input.paymentId,
      });
    },
    async verify(payment) {
      const id = payment.transactionId ?? payment.externalId;
      if (!id) return err(failure("kkiapay_no_transaction"));
      const tx = await transaction(id);
      if (!tx.ok) return tx;
      // La transaction doit payer CE paiement : même référence (exigée, sans
      // repli sur un autre champ), même montant ; une transaction ne sert
      // qu'une fois (index unique).
      if (tx.value.reference !== payment.id)
        return err(failure("kkiapay_reference_mismatch"));
      if (
        tx.value.status === "succeeded" &&
        tx.value.amount !== payment.amountMinor
      )
        return err(failure("kkiapay_amount_mismatch"));
      return ok({
        status: tx.value.status,
        externalId: id,
        externalSubscriptionId: null,
      });
    },
  };
}

/** En-tête secret d'un webhook Kkiapay, comparé en temps constant. */
export function verifyKkiapaySecret(
  header: string | undefined,
  secret: string,
): boolean {
  if (!header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
