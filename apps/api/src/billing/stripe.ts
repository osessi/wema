import { createHmac, timingSafeEqual } from "node:crypto";
import { err, ok } from "@wema/domain";
import type { BillingEvent } from "./events";
import { pick, pickNumber, pickString } from "./json";
import type { Fetch, PaymentProvider, ProviderError } from "./types";

// Stripe, par son API HTTP (https://docs.stripe.com/api) : Checkout en mode
// abonnement, avec un prix créé à la volée depuis l'offre (price_data). Le
// renouvellement mensuel est fait par Stripe et annoncé par webhook.

export interface StripeConfig {
  secretKey: string;
  baseUrl?: string;
}

/** Écart toléré entre l'horodatage signé et l'heure du serveur (rejeu). */
export const STRIPE_TOLERANCE_SECONDS = 300;

const failure = (reason: string): ProviderError => ({
  kind: "provider_failed",
  reason,
});

/** Corps application/x-www-form-urlencoded, avec la notation à crochets de Stripe. */
export function formEncode(fields: Record<string, string | number>): string {
  return Object.entries(fields)
    .map(
      ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`,
    )
    .join("&");
}

export function createStripeProvider(
  config: StripeConfig,
  fetcher: Fetch = fetch,
): PaymentProvider {
  const base = config.baseUrl ?? "https://api.stripe.com";
  const headers = (extra: Record<string, string> = {}) => ({
    authorization: `Bearer ${config.secretKey}`,
    "content-type": "application/x-www-form-urlencoded",
    ...extra,
  });
  const call = async (
    method: string,
    path: string,
    body?: string,
    extra?: Record<string, string>,
  ) => {
    try {
      const res = await fetcher(`${base}${path}`, {
        method,
        headers: headers(extra),
        ...(body === undefined ? {} : { body }),
      });
      const json: unknown = await res.json().catch(() => null);
      return { reached: true as const, status: res.status, json };
    } catch {
      return { reached: false as const, status: 0, json: null };
    }
  };

  return {
    name: "stripe",
    async start(input) {
      const res = await call(
        "POST",
        "/v1/checkout/sessions",
        formEncode({
          mode: "subscription",
          client_reference_id: input.paymentId,
          "metadata[payment_id]": input.paymentId,
          "subscription_data[metadata][payment_id]": input.paymentId,
          "line_items[0][quantity]": 1,
          "line_items[0][price_data][currency]": input.currency.toLowerCase(),
          "line_items[0][price_data][unit_amount]": input.amountMinor,
          "line_items[0][price_data][recurring][interval]": "month",
          "line_items[0][price_data][recurring][interval_count]":
            input.intervalMonths,
          "line_items[0][price_data][product_data][name]": input.description,
          success_url: input.returnUrl,
          cancel_url: input.cancelUrl,
        }),
        // Une double demande pour le même paiement ne crée qu'une session.
        { "idempotency-key": `wema-${input.paymentId}` },
      );
      if (!res.reached) return err(failure("stripe_unreachable"));
      const url = pickString(res.json, "url");
      const id = pickString(res.json, "id");
      if (res.status >= 300 || !url || !id)
        return err(failure(`stripe_${res.status}`));
      return ok({ kind: "redirect", url, externalId: id });
    },

    async verify(payment) {
      if (!payment.externalId) return err(failure("stripe_no_session"));
      const res = await call(
        "GET",
        `/v1/checkout/sessions/${encodeURIComponent(payment.externalId)}`,
      );
      if (!res.reached) return err(failure("stripe_unreachable"));
      if (res.status >= 300) return err(failure(`stripe_${res.status}`));
      if (pickString(res.json, "client_reference_id") !== payment.id)
        return err(failure("stripe_reference_mismatch"));
      const subscription = pick(res.json, "subscription");
      const subscriptionId =
        typeof subscription === "string"
          ? subscription
          : (pickString(subscription, "id") ?? null);
      const status = pickString(res.json, "status");
      const paid = pickString(res.json, "payment_status");
      return ok({
        status:
          status === "complete" && paid !== "unpaid"
            ? "succeeded"
            : status === "expired"
              ? "failed"
              : "pending",
        externalId: payment.externalId,
        externalSubscriptionId: subscriptionId,
      });
    },

    async cancelAtPeriodEnd(externalSubscriptionId) {
      const res = await call(
        "POST",
        `/v1/subscriptions/${encodeURIComponent(externalSubscriptionId)}`,
        formEncode({ cancel_at_period_end: "true" }),
      );
      if (!res.reached) return err(failure("stripe_unreachable"));
      if (res.status >= 300) return err(failure(`stripe_${res.status}`));
      return ok(undefined);
    },
  };
}

/**
 * Vérifie l'en-tête Stripe-Signature (`t=…,v1=…`) : HMAC-SHA256 de
 * `t.corps` avec le secret du webhook, comparé en temps constant, et
 * horodatage récent (un envoi capturé ne peut pas être rejoué plus tard).
 */
export function verifyStripeSignature(input: {
  payload: string;
  header: string | undefined;
  secret: string;
  now: Date;
  toleranceSeconds?: number;
}): boolean {
  if (!input.header) return false;
  let timestamp: string | null = null;
  const signatures: string[] = [];
  for (const part of input.header.split(",")) {
    const [key, value] = part.split("=", 2);
    if (!key || !value) continue;
    if (key.trim() === "t") timestamp = value.trim();
    else if (key.trim() === "v1") signatures.push(value.trim());
  }
  if (!timestamp || !/^\d+$/.test(timestamp) || signatures.length === 0)
    return false;
  const age = Math.abs(input.now.getTime() / 1000 - Number(timestamp));
  if (age > (input.toleranceSeconds ?? STRIPE_TOLERANCE_SECONDS)) return false;
  const expected = createHmac("sha256", input.secret)
    .update(`${timestamp}.${input.payload}`)
    .digest();
  return signatures.some((s) => {
    const given = Buffer.from(s, "hex");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

/** Signature d'un corps, comme Stripe la calcule (tests et outils locaux). */
export function signStripePayload(
  payload: string,
  secret: string,
  at: Date,
): string {
  const t = Math.floor(at.getTime() / 1000);
  const v1 = createHmac("sha256", secret)
    .update(`${t}.${payload}`)
    .digest("hex");
  return `t=${t},v1=${v1}`;
}

/** Abonnement d'une facture (ancienne et nouvelle forme de l'API Stripe). */
function invoiceSubscription(invoice: unknown): string | null {
  const direct = pick(invoice, "subscription");
  if (typeof direct === "string") return direct;
  const nested = pickString(
    pick(pick(invoice, "parent"), "subscription_details"),
    "subscription",
  );
  return nested ?? pickString(direct, "id") ?? null;
}

/** Traduit un événement Stripe (déjà authentifié) en événement de facturation. */
export function parseStripeEvent(event: unknown): {
  id: string | null;
  type: string;
  event: BillingEvent;
} {
  const id = pickString(event, "id") ?? null;
  const type = pickString(event, "type") ?? "unknown";
  const object = pick(pick(event, "data"), "object");
  const ignored = { id, type, event: { kind: "ignored" as const } };
  switch (type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const paymentId = pickString(object, "client_reference_id");
      const sessionId = pickString(object, "id");
      if (!paymentId || !sessionId) return ignored;
      if (pickString(object, "payment_status") === "unpaid") return ignored;
      const sub = pick(object, "subscription");
      return {
        id,
        type,
        event: {
          kind: "payment_succeeded",
          paymentId,
          externalId: sessionId,
          externalSubscriptionId:
            typeof sub === "string" ? sub : (pickString(sub, "id") ?? null),
        },
      };
    }
    case "checkout.session.expired":
    case "checkout.session.async_payment_failed": {
      const paymentId = pickString(object, "client_reference_id");
      return paymentId
        ? { id, type, event: { kind: "payment_failed", paymentId } }
        : ignored;
    }
    case "invoice.paid": {
      // La première facture est déjà couverte par checkout.session.completed.
      if (pickString(object, "billing_reason") === "subscription_create")
        return ignored;
      const subscriptionId = invoiceSubscription(object);
      const invoiceId = pickString(object, "id");
      if (!subscriptionId || !invoiceId) return ignored;
      const line = pick(pick(object, "lines"), "data");
      const first = Array.isArray(line) ? line[0] : undefined;
      const end = pickNumber(pick(first, "period"), "end");
      return {
        id,
        type,
        event: {
          kind: "renewal_paid",
          provider: "stripe",
          externalSubscriptionId: subscriptionId,
          externalId: invoiceId,
          amountMinor: pickNumber(object, "amount_paid") ?? 0,
          currency: (pickString(object, "currency") ?? "").toUpperCase(),
          periodEnd: end ? new Date(end * 1000) : null,
        },
      };
    }
    case "invoice.payment_failed": {
      const subscriptionId = invoiceSubscription(object);
      return subscriptionId
        ? {
            id,
            type,
            event: {
              kind: "renewal_failed",
              provider: "stripe",
              externalSubscriptionId: subscriptionId,
            },
          }
        : ignored;
    }
    case "customer.subscription.deleted": {
      const subscriptionId = pickString(object, "id");
      return subscriptionId
        ? {
            id,
            type,
            event: {
              kind: "subscription_ended",
              provider: "stripe",
              externalSubscriptionId: subscriptionId,
            },
          }
        : ignored;
    }
    default:
      return ignored;
  }
}
