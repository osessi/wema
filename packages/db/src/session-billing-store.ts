import { randomUUID } from "node:crypto";
import {
  asCountryId,
  asUserId,
  type CountryId,
  type UserId,
} from "@wema/domain";
import {
  PAYMENT_METHODS,
  type PaymentMethod,
  type PaymentProviderName,
  type PaymentStatus,
} from "./billing-store";
import type { SqlExecutor } from "./executor";

// Séance supplémentaire payante (migration 0033) : prix par pays fixé par
// l'équipe Wema, montant dû par séance réservée, paiements de séances.

export interface SessionPrice {
  countryId: CountryId;
  countryName: string;
  currency: string;
  amountMinor: number;
  methods: PaymentMethod[];
}

export interface SessionCharge {
  sessionId: string;
  countryId: CountryId;
  currency: string;
  amountMinor: number;
  methods: PaymentMethod[];
  payerId: UserId | null;
  paidAt: Date | null;
}

export interface SessionPayment {
  id: string;
  sessionId: string;
  payerId: UserId | null;
  provider: PaymentProviderName;
  method: PaymentMethod;
  amountMinor: number;
  currency: string;
  status: PaymentStatus;
  externalId: string | null;
}

const isMethod = (m: string): m is PaymentMethod =>
  PAYMENT_METHODS.some((x) => x === m);
const PROVIDERS: readonly PaymentProviderName[] = ["stripe", "kkiapay", "dev"];
const STATUSES: readonly PaymentStatus[] = ["pending", "succeeded", "failed"];

interface PaymentRow {
  id: string;
  session_id: string;
  payer_id: string | null;
  provider: string;
  method: string;
  amount_minor: number;
  currency: string;
  status: string;
  external_id: string | null;
}

const toPayment = (r: PaymentRow): SessionPayment => {
  const provider = PROVIDERS.find((p) => p === r.provider);
  const status = STATUSES.find((s) => s === r.status);
  if (!provider || !status)
    throw new Error(`paiement de séance incohérent : ${r.id}`);
  return {
    id: r.id,
    sessionId: r.session_id,
    payerId: r.payer_id ? asUserId(r.payer_id) : null,
    provider,
    method: isMethod(r.method) ? r.method : "card",
    amountMinor: Number(r.amount_minor),
    currency: r.currency,
    status,
    externalId: r.external_id,
  };
};

export function createSessionBillingStore(db: SqlExecutor) {
  return {
    // Prix ------------------------------------------------------------------

    async listPrices(): Promise<SessionPrice[]> {
      const { rows } = await db.query<{
        country_id: string;
        country_name: string;
        currency: string;
        amount_minor: number;
        methods: string[];
      }>(
        `SELECT sp.country_id, c.name AS country_name, sp.currency, sp.amount_minor, sp.methods
         FROM session_prices sp JOIN countries c ON c.id = sp.country_id ORDER BY c.name`,
      );
      return rows.map((r) => ({
        countryId: asCountryId(r.country_id),
        countryName: r.country_name,
        currency: r.currency,
        amountMinor: Number(r.amount_minor),
        methods: r.methods.filter(isMethod),
      }));
    },

    /** Fixe (ou remplace) le prix d'une séance dans un pays. Faux si le pays n'existe pas. */
    async setPrice(input: {
      countryId: CountryId;
      currency: string;
      amountMinor: number;
      methods: readonly PaymentMethod[];
      now: Date;
    }): Promise<boolean> {
      const { rows } = await db.query(
        `INSERT INTO session_prices (country_id, currency, amount_minor, methods, updated_at)
         SELECT id, $2, $3, $4, $5 FROM countries WHERE id = $1
         ON CONFLICT (country_id) DO UPDATE SET currency = EXCLUDED.currency,
           amount_minor = EXCLUDED.amount_minor, methods = EXCLUDED.methods, updated_at = EXCLUDED.updated_at
         RETURNING country_id`,
        [
          input.countryId,
          input.currency,
          input.amountMinor,
          [...input.methods],
          input.now,
        ],
      );
      return rows.length > 0;
    },

    /** Retire le prix : les séances de ce pays redeviennent gratuites. */
    async removePrice(countryId: CountryId): Promise<boolean> {
      const { rows } = await db.query(
        "DELETE FROM session_prices WHERE country_id = $1 RETURNING country_id",
        [countryId],
      );
      return rows.length > 0;
    },

    // Montant dû par séance --------------------------------------------------

    async addCharge(input: {
      sessionId: string;
      price: Pick<
        SessionPrice,
        "countryId" | "currency" | "amountMinor" | "methods"
      >;
      payerId: UserId;
    }): Promise<void> {
      await db.query(
        `INSERT INTO session_charges (session_id, country_id, currency, amount_minor, methods, payer_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          input.sessionId,
          input.price.countryId,
          input.price.currency,
          input.price.amountMinor,
          [...input.price.methods],
          input.payerId,
        ],
      );
    },

    async getCharge(sessionId: string): Promise<SessionCharge | null> {
      const { rows } = await db.query<{
        session_id: string;
        country_id: string;
        currency: string;
        amount_minor: number;
        methods: string[];
        payer_id: string | null;
        paid_at: Date | null;
      }>(
        `SELECT session_id, country_id, currency, amount_minor, methods, payer_id, paid_at
         FROM session_charges WHERE session_id = $1`,
        [sessionId],
      );
      const r = rows[0];
      return r
        ? {
            sessionId: r.session_id,
            countryId: asCountryId(r.country_id),
            currency: r.currency,
            amountMinor: Number(r.amount_minor),
            methods: r.methods.filter(isMethod),
            payerId: r.payer_id ? asUserId(r.payer_id) : null,
            paidAt: r.paid_at,
          }
        : null;
    },

    // Paiements -------------------------------------------------------------

    async createPayment(input: {
      charge: SessionCharge;
      payerId: UserId;
      provider: PaymentProviderName;
      method: PaymentMethod;
      now: Date;
    }): Promise<SessionPayment> {
      const id = randomUUID();
      const { rows } = await db.query<PaymentRow>(
        `INSERT INTO session_payments (id, session_id, payer_id, provider, method, amount_minor, currency, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)
         RETURNING id, session_id, payer_id, provider, method, amount_minor, currency, status, external_id`,
        [
          id,
          input.charge.sessionId,
          input.payerId,
          input.provider,
          input.method,
          input.charge.amountMinor,
          input.charge.currency,
          input.now,
        ],
      );
      const row = rows[0];
      if (!row) throw new Error("paiement de séance non créé");
      return toPayment(row);
    },

    async getPayment(id: string): Promise<SessionPayment | null> {
      const { rows } = await db.query<PaymentRow>(
        `SELECT id, session_id, payer_id, provider, method, amount_minor, currency, status, external_id
         FROM session_payments WHERE id = $1`,
        [id],
      );
      return rows[0] ? toPayment(rows[0]) : null;
    },

    async setPaymentExternal(id: string, externalId: string): Promise<void> {
      await db.query(
        "UPDATE session_payments SET external_id = $2 WHERE id = $1",
        [id, externalId],
      );
    },

    async markPaymentFailed(id: string): Promise<boolean> {
      const { rows } = await db.query(
        "UPDATE session_payments SET status = 'failed' WHERE id = $1 AND status = 'pending' RETURNING id",
        [id],
      );
      return rows.length > 0;
    },

    /**
     * Paiement réussi : la séance est réglée, puis confirmée si elle attendait
     * encore (demandée ou nouvel horaire proposé). Idempotent.
     */
    async applyPaymentSuccess(input: {
      paymentId: string;
      externalId: string;
      now: Date;
    }): Promise<{ applied: boolean; confirmed: boolean }> {
      return db.transaction(async (tx) => {
        const { rows } = await tx.query<{ session_id: string }>(
          `UPDATE session_payments SET status = 'succeeded', paid_at = $2,
             external_id = COALESCE(external_id, $3)
           WHERE id = $1 AND status = 'pending' RETURNING session_id`,
          [input.paymentId, input.now, input.externalId],
        );
        const sessionId = rows[0]?.session_id;
        if (!sessionId) return { applied: false, confirmed: false };
        await tx.query(
          "UPDATE session_charges SET paid_at = COALESCE(paid_at, $2) WHERE session_id = $1",
          [sessionId, input.now],
        );
        const { rows: confirmed } = await tx.query(
          `UPDATE tutoring_sessions SET status = 'confirmed', updated_at = now()
           WHERE id = $1 AND status IN ('requested', 'proposed') AND ends_at > $2 RETURNING id`,
          [sessionId, input.now],
        );
        return { applied: true, confirmed: confirmed.length > 0 };
      });
    },
  };
}

export type SessionBillingStore = ReturnType<typeof createSessionBillingStore>;
