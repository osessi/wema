import { randomUUID } from "node:crypto";
import type {
  CountryId,
  LearnerId,
  NotionId,
  OrganizationId,
  SubjectId,
  UserId,
} from "@wema/domain";
import {
  asCountryId,
  asLearnerId,
  asOrganizationId,
  asSubjectId,
  asUserId,
} from "@wema/domain";
import type { SqlExecutor } from "./executor";

// Paiement (fiche 0009) : offres, abonnements élève × matière, paiements.
// Les montants sont en plus petite unité de la devise (ISO 4217).

export type PaymentMethod = "card" | "mobile_money";
export type PaymentProviderName = "stripe" | "kkiapay" | "dev";
export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "ended";
export type PaymentStatus = "pending" | "succeeded" | "failed";
/** Ce qui ouvre l'accès à une matière. */
export type AccessSource = "contract" | "subscription" | "trial";

export const PAYMENT_METHODS: readonly PaymentMethod[] = [
  "card",
  "mobile_money",
];

export interface Offer {
  id: string;
  countryId: CountryId;
  countryName: string;
  subjectId: SubjectId;
  subjectName: string;
  currency: string;
  amountMinor: number;
  intervalMonths: number;
  trialDays: number;
  methods: PaymentMethod[];
  active: boolean;
}

export interface OfferInput {
  countryId: CountryId;
  subjectId: SubjectId;
  currency: string;
  amountMinor: number;
  intervalMonths: number;
  trialDays: number;
  methods: readonly PaymentMethod[];
  active: boolean;
}

export interface Subscription {
  id: string;
  learnerId: LearnerId;
  learnerName: string;
  subjectId: SubjectId;
  subjectName: string;
  offerId: string;
  payerId: UserId | null;
  payerName: string | null;
  provider: PaymentProviderName | null;
  status: SubscriptionStatus;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  externalId: string | null;
  createdAt: Date;
  endedAt: Date | null;
}

export interface Payment {
  id: string;
  subscriptionId: string | null;
  learnerId: LearnerId;
  learnerName: string;
  subjectId: SubjectId;
  subjectName: string;
  offerId: string;
  payerId: UserId | null;
  payerName: string | null;
  provider: PaymentProviderName;
  method: PaymentMethod;
  kind: "initial" | "renewal";
  amountMinor: number;
  currency: string;
  intervalMonths: number;
  status: PaymentStatus;
  externalId: string | null;
  createdAt: Date;
  paidAt: Date | null;
}

export interface ContractOrganization {
  id: OrganizationId;
  name: string;
  kind: "school" | "tutoring";
  underContract: boolean;
}

export type OfferError =
  | { kind: "offer_conflict" }
  | { kind: "invalid_reference" };

/** Ajoute `months` mois à une date (fin de mois bornée : 31 janv. + 1 = 28/29 févr.). */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

/**
 * Accès ouvert par un abonnement : essai non échu, ou période payée non échue
 * (y compris résilié ou renouvellement refusé : on garde ce qui est payé).
 */
const OPEN_SUBSCRIPTION = `(
  (s.status = 'trialing' AND s.trial_ends_at > $3)
  OR (s.status IN ('active', 'past_due', 'canceled') AND s.current_period_end > $3)
)`;

interface OfferRow {
  id: string;
  country_id: string;
  country_name: string;
  subject_id: string;
  subject_name: string;
  currency: string;
  amount_minor: number;
  interval_months: number;
  trial_days: number;
  methods: string[];
  active: boolean;
}

const OFFER_SELECT = `SELECT o.id, o.country_id, c.name AS country_name, o.subject_id, s.name AS subject_name,
  o.currency, o.amount_minor, o.interval_months, o.trial_days, o.methods, o.active
  FROM offers o JOIN countries c ON c.id = o.country_id JOIN subjects s ON s.id = o.subject_id`;

const isMethod = (m: string): m is PaymentMethod =>
  PAYMENT_METHODS.some((x) => x === m);
const PROVIDERS: readonly PaymentProviderName[] = ["stripe", "kkiapay", "dev"];
const asProvider = (p: string): PaymentProviderName => {
  const found = PROVIDERS.find((x) => x === p);
  if (!found) throw new Error(`fournisseur inconnu en base : ${p}`);
  return found;
};
const STATUSES: readonly SubscriptionStatus[] = [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "ended",
];
const asStatus = (s: string): SubscriptionStatus => {
  const found = STATUSES.find((x) => x === s);
  if (!found) throw new Error(`statut inconnu en base : ${s}`);
  return found;
};
const PAYMENT_STATUSES: readonly PaymentStatus[] = [
  "pending",
  "succeeded",
  "failed",
];
const asPaymentStatus = (s: string): PaymentStatus => {
  const found = PAYMENT_STATUSES.find((x) => x === s);
  if (!found) throw new Error(`statut de paiement inconnu en base : ${s}`);
  return found;
};

const toOffer = (r: OfferRow): Offer => ({
  id: r.id,
  countryId: asCountryId(r.country_id),
  countryName: r.country_name,
  subjectId: asSubjectId(r.subject_id),
  subjectName: r.subject_name,
  currency: r.currency,
  amountMinor: Number(r.amount_minor),
  intervalMonths: r.interval_months,
  trialDays: r.trial_days,
  methods: r.methods.filter(isMethod),
  active: r.active,
});

interface SubscriptionRow {
  id: string;
  learner_id: string;
  learner_name: string;
  subject_id: string;
  subject_name: string;
  offer_id: string;
  payer_id: string | null;
  payer_name: string | null;
  provider: string | null;
  status: string;
  trial_ends_at: Date | null;
  current_period_end: Date | null;
  external_id: string | null;
  created_at: Date;
  ended_at: Date | null;
}

const SUBSCRIPTION_SELECT = `SELECT s.id, s.learner_id, l.display_name AS learner_name, s.subject_id,
  sj.name AS subject_name, s.offer_id, s.payer_id, p.display_name AS payer_name, s.provider, s.status,
  s.trial_ends_at, s.current_period_end, s.external_id, s.created_at, s.ended_at
  FROM subscriptions s JOIN users l ON l.id = s.learner_id JOIN subjects sj ON sj.id = s.subject_id
  LEFT JOIN users p ON p.id = s.payer_id`;

const toSubscription = (r: SubscriptionRow): Subscription => ({
  id: r.id,
  learnerId: asLearnerId(r.learner_id),
  learnerName: r.learner_name,
  subjectId: asSubjectId(r.subject_id),
  subjectName: r.subject_name,
  offerId: r.offer_id,
  payerId: r.payer_id ? asUserId(r.payer_id) : null,
  payerName: r.payer_name,
  provider: r.provider ? asProvider(r.provider) : null,
  status: asStatus(r.status),
  trialEndsAt: r.trial_ends_at,
  currentPeriodEnd: r.current_period_end,
  externalId: r.external_id,
  createdAt: r.created_at,
  endedAt: r.ended_at,
});

interface PaymentRow {
  id: string;
  subscription_id: string | null;
  learner_id: string;
  learner_name: string;
  subject_id: string;
  subject_name: string;
  offer_id: string;
  payer_id: string | null;
  payer_name: string | null;
  provider: string;
  method: string;
  kind: string;
  amount_minor: number;
  currency: string;
  interval_months: number;
  status: string;
  external_id: string | null;
  created_at: Date;
  paid_at: Date | null;
}

const PAYMENT_SELECT = `SELECT pm.id, pm.subscription_id, pm.learner_id, l.display_name AS learner_name,
  pm.subject_id, sj.name AS subject_name, pm.offer_id, pm.payer_id, p.display_name AS payer_name,
  pm.provider, pm.method, pm.kind, pm.amount_minor, pm.currency, pm.interval_months, pm.status,
  pm.external_id, pm.created_at, pm.paid_at
  FROM payments pm JOIN users l ON l.id = pm.learner_id JOIN subjects sj ON sj.id = pm.subject_id
  LEFT JOIN users p ON p.id = pm.payer_id`;

const toPayment = (r: PaymentRow): Payment => ({
  id: r.id,
  subscriptionId: r.subscription_id,
  learnerId: asLearnerId(r.learner_id),
  learnerName: r.learner_name,
  subjectId: asSubjectId(r.subject_id),
  subjectName: r.subject_name,
  offerId: r.offer_id,
  payerId: r.payer_id ? asUserId(r.payer_id) : null,
  payerName: r.payer_name,
  provider: asProvider(r.provider),
  method: isMethod(r.method) ? r.method : "card",
  kind: r.kind === "renewal" ? "renewal" : "initial",
  amountMinor: Number(r.amount_minor),
  currency: r.currency,
  intervalMonths: r.interval_months,
  status: asPaymentStatus(r.status),
  externalId: r.external_id,
  createdAt: r.created_at,
  paidAt: r.paid_at,
});

/** Violation d'une contrainte unique ou d'une clé étrangère (Postgres). */
function pgCode(e: unknown): string | null {
  if (typeof e !== "object" || e === null || !("code" in e)) return null;
  return typeof e.code === "string" ? e.code : null;
}

export function createBillingStore(db: SqlExecutor) {
  const store = {
    // Offres -------------------------------------------------------------------

    async listOffers(filter: { activeOnly?: boolean } = {}): Promise<Offer[]> {
      const { rows } = await db.query<OfferRow>(
        `${OFFER_SELECT} ${filter.activeOnly ? "WHERE o.active" : ""} ORDER BY c.name, s.name, o.active DESC`,
      );
      return rows.map(toOffer);
    },

    async getOffer(id: string): Promise<Offer | null> {
      const { rows } = await db.query<OfferRow>(
        `${OFFER_SELECT} WHERE o.id = $1`,
        [id],
      );
      return rows[0] ? toOffer(rows[0]) : null;
    },

    async createOffer(
      input: OfferInput,
    ): Promise<{ ok: true; id: string } | { ok: false; error: OfferError }> {
      const id = randomUUID();
      try {
        await db.query(
          `INSERT INTO offers (id, country_id, subject_id, currency, amount_minor, interval_months, trial_days, methods, active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            id,
            input.countryId,
            input.subjectId,
            input.currency,
            input.amountMinor,
            input.intervalMonths,
            input.trialDays,
            [...input.methods],
            input.active,
          ],
        );
      } catch (e) {
        if (pgCode(e) === "23505")
          return { ok: false, error: { kind: "offer_conflict" } };
        if (pgCode(e) === "23503")
          return { ok: false, error: { kind: "invalid_reference" } };
        throw e;
      }
      return { ok: true, id };
    },

    /** Modifie le prix, l'essai, les moyens de paiement ou l'état d'une offre. */
    async updateOffer(
      id: string,
      input: Omit<OfferInput, "countryId" | "subjectId">,
      now: Date,
    ): Promise<
      { ok: true } | { ok: false; error: OfferError | { kind: "not_found" } }
    > {
      try {
        const { rows } = await db.query(
          `UPDATE offers SET currency = $2, amount_minor = $3, interval_months = $4, trial_days = $5,
             methods = $6, active = $7, updated_at = $8 WHERE id = $1 RETURNING id`,
          [
            id,
            input.currency,
            input.amountMinor,
            input.intervalMonths,
            input.trialDays,
            [...input.methods],
            input.active,
            now,
          ],
        );
        if (rows.length === 0)
          return { ok: false, error: { kind: "not_found" } };
      } catch (e) {
        if (pgCode(e) === "23505")
          return { ok: false, error: { kind: "offer_conflict" } };
        throw e;
      }
      return { ok: true };
    },

    // Droits d'accès -------------------------------------------------------------

    /** Matière d'une notion (notion → unité → programme). */
    async subjectOfNotion(notionId: NotionId): Promise<SubjectId | null> {
      const { rows } = await db.query<{ subject_id: string }>(
        `SELECT p.subject_id FROM notions n JOIN units u ON u.id = n.unit_id
         JOIN programs p ON p.id = u.program_id WHERE n.id = $1`,
        [notionId],
      );
      return rows[0] ? asSubjectId(rows[0].subject_id) : null;
    },

    /**
     * Ce qui ouvre l'accès de l'élève à la matière, ou `null`. Une organisation
     * sous contrat ouvre toutes les matières de ses élèves.
     */
    async accessSource(
      learnerId: LearnerId,
      subjectId: SubjectId,
      now: Date,
    ): Promise<AccessSource | null> {
      const { rows } = await db.query<{ source: AccessSource }>(
        `SELECT 'contract' AS source FROM memberships m JOIN organizations o ON o.id = m.organization_id
           WHERE m.user_id = $1 AND o.under_contract AND o.kind IN ('school', 'tutoring')
         UNION ALL
         SELECT CASE WHEN s.status = 'trialing' THEN 'trial' ELSE 'subscription' END
           FROM subscriptions s WHERE s.learner_id = $1 AND s.subject_id = $2 AND ${OPEN_SUBSCRIPTION}
         LIMIT 1`,
        [learnerId, subjectId, now],
      );
      return rows[0]?.source ?? null;
    },

    /** Vrai si l'élève est membre d'une organisation sous contrat. */
    async underContract(learnerId: LearnerId): Promise<boolean> {
      const { rows } = await db.query(
        `SELECT 1 FROM memberships m JOIN organizations o ON o.id = m.organization_id
         WHERE m.user_id = $1 AND o.under_contract AND o.kind IN ('school', 'tutoring')`,
        [learnerId],
      );
      return rows.length > 0;
    },

    /**
     * Pays des programmes de l'élève : ceux de ses classes et son programme
     * individuel (pour proposer les offres de son pays).
     */
    async countriesOfLearner(learnerId: LearnerId): Promise<CountryId[]> {
      const { rows } = await db.query<{ country_id: string }>(
        `SELECT p.country_id FROM class_members m JOIN classes k ON k.id = m.class_id
         JOIN programs p ON p.id = k.program_id
         WHERE m.user_id = $1 AND m.role = 'learner' AND k.archived_at IS NULL
         UNION
         SELECT p.country_id FROM learner_programs lp JOIN programs p ON p.id = lp.program_id
         WHERE lp.learner_id = $1 AND p.archived_at IS NULL`,
        [learnerId],
      );
      return rows.map((r) => asCountryId(r.country_id));
    },

    // Abonnements ----------------------------------------------------------------

    async getSubscription(id: string): Promise<Subscription | null> {
      const { rows } = await db.query<SubscriptionRow>(
        `${SUBSCRIPTION_SELECT} WHERE s.id = $1`,
        [id],
      );
      return rows[0] ? toSubscription(rows[0]) : null;
    },

    /** Abonnement en cours (non terminé) d'un élève à une matière. */
    async liveSubscription(
      learnerId: LearnerId,
      subjectId: SubjectId,
    ): Promise<Subscription | null> {
      const { rows } = await db.query<SubscriptionRow>(
        `${SUBSCRIPTION_SELECT} WHERE s.learner_id = $1 AND s.subject_id = $2 AND s.status <> 'ended'`,
        [learnerId, subjectId],
      );
      return rows[0] ? toSubscription(rows[0]) : null;
    },

    async subscriptionByExternal(
      provider: PaymentProviderName,
      externalId: string,
    ): Promise<Subscription | null> {
      const { rows } = await db.query<SubscriptionRow>(
        `${SUBSCRIPTION_SELECT} WHERE s.provider = $1 AND s.external_id = $2`,
        [provider, externalId],
      );
      return rows[0] ? toSubscription(rows[0]) : null;
    },

    /** Vrai si l'élève a déjà eu un abonnement (ou un essai) à cette matière. */
    async hadSubscription(
      learnerId: LearnerId,
      subjectId: SubjectId,
    ): Promise<boolean> {
      const { rows } = await db.query(
        "SELECT 1 FROM subscriptions WHERE learner_id = $1 AND subject_id = $2 LIMIT 1",
        [learnerId, subjectId],
      );
      return rows.length > 0;
    },

    async listSubscriptions(
      filter: { learnerIds?: readonly LearnerId[]; limit?: number } = {},
    ): Promise<Subscription[]> {
      const { rows } = filter.learnerIds
        ? await db.query<SubscriptionRow>(
            `${SUBSCRIPTION_SELECT} WHERE s.learner_id = ANY($1::uuid[]) ORDER BY s.created_at DESC`,
            [[...filter.learnerIds]],
          )
        : await db.query<SubscriptionRow>(
            `${SUBSCRIPTION_SELECT} ORDER BY s.created_at DESC LIMIT $1`,
            [filter.limit ?? 200],
          );
      return rows.map(toSubscription);
    },

    async startTrial(input: {
      learnerId: LearnerId;
      subjectId: SubjectId;
      offerId: string;
      payerId: UserId;
      endsAt: Date;
      now: Date;
    }): Promise<string | null> {
      try {
        const id = randomUUID();
        await db.query(
          `INSERT INTO subscriptions (id, learner_id, subject_id, offer_id, payer_id, status, trial_ends_at, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, 'trialing', $6, $7, $7)`,
          [
            id,
            input.learnerId,
            input.subjectId,
            input.offerId,
            input.payerId,
            input.endsAt,
            input.now,
          ],
        );
        return id;
      } catch (e) {
        if (pgCode(e) === "23505") return null;
        throw e;
      }
    },

    async setSubscriptionStatus(
      id: string,
      status: SubscriptionStatus,
      now: Date,
      options: { periodEnd?: Date } = {},
    ): Promise<void> {
      await db.query(
        `UPDATE subscriptions SET status = $2, updated_at = $3,
           ended_at = CASE WHEN $2 = 'ended' THEN $3 ELSE ended_at END,
           current_period_end = COALESCE($4, current_period_end)
         WHERE id = $1`,
        [id, status, now, options.periodEnd ?? null],
      );
    },

    // Paiements ------------------------------------------------------------------

    async createPayment(input: {
      learnerId: LearnerId;
      subjectId: SubjectId;
      offer: Offer;
      payerId: UserId;
      provider: PaymentProviderName;
      method: PaymentMethod;
      now: Date;
    }): Promise<Payment> {
      const id = randomUUID();
      await db.query(
        `INSERT INTO payments (id, learner_id, subject_id, offer_id, payer_id, provider, method, kind,
           amount_minor, currency, interval_months, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'initial', $8, $9, $10, 'pending', $11)`,
        [
          id,
          input.learnerId,
          input.subjectId,
          input.offer.id,
          input.payerId,
          input.provider,
          input.method,
          input.offer.amountMinor,
          input.offer.currency,
          input.offer.intervalMonths,
          input.now,
        ],
      );
      const payment = await store.getPayment(id);
      if (!payment) throw new Error("paiement créé introuvable");
      return payment;
    },

    async getPayment(id: string): Promise<Payment | null> {
      const { rows } = await db.query<PaymentRow>(
        `${PAYMENT_SELECT} WHERE pm.id = $1`,
        [id],
      );
      return rows[0] ? toPayment(rows[0]) : null;
    },

    async setPaymentExternal(id: string, externalId: string): Promise<void> {
      await db.query("UPDATE payments SET external_id = $2 WHERE id = $1", [
        id,
        externalId,
      ]);
    },

    async listPayments(
      filter: { payerId?: UserId; limit?: number } = {},
    ): Promise<Payment[]> {
      const { rows } = filter.payerId
        ? await db.query<PaymentRow>(
            `${PAYMENT_SELECT} WHERE pm.payer_id = $1 ORDER BY pm.created_at DESC LIMIT $2`,
            [filter.payerId, filter.limit ?? 50],
          )
        : await db.query<PaymentRow>(
            `${PAYMENT_SELECT} ORDER BY pm.created_at DESC LIMIT $1`,
            [filter.limit ?? 200],
          );
      return rows.map(toPayment);
    },

    /**
     * Paiement réussi : active ou prolonge l'abonnement de l'élève à la matière.
     * Idempotent : un paiement déjà réussi n'est jamais appliqué deux fois.
     * La nouvelle période part de l'échéance en cours si elle n'est pas passée
     * (un renouvellement anticipé ne fait rien perdre).
     */
    async applyPaymentSuccess(input: {
      paymentId: string;
      externalId: string | null;
      externalSubscriptionId: string | null;
      now: Date;
    }): Promise<{ applied: boolean; subscriptionId: string | null }> {
      return db.transaction(async (tx) => {
        const { rows } = await tx.query<{
          learner_id: string;
          subject_id: string;
          offer_id: string;
          payer_id: string | null;
          provider: string;
          interval_months: number;
        }>(
          `UPDATE payments SET status = 'succeeded', paid_at = $2, external_id = COALESCE(external_id, $3)
           WHERE id = $1 AND status = 'pending'
           RETURNING learner_id, subject_id, offer_id, payer_id, provider, interval_months`,
          [input.paymentId, input.now, input.externalId],
        );
        const p = rows[0];
        if (!p) {
          const existing = await createBillingStore(tx).getPayment(
            input.paymentId,
          );
          return {
            applied: false,
            subscriptionId: existing?.subscriptionId ?? null,
          };
        }
        const { rows: live } = await tx.query<{
          id: string;
          status: string;
          trial_ends_at: Date | null;
          current_period_end: Date | null;
        }>(
          `SELECT id, status, trial_ends_at, current_period_end FROM subscriptions
           WHERE learner_id = $1 AND subject_id = $2 AND status <> 'ended' FOR UPDATE`,
          [p.learner_id, p.subject_id],
        );
        const current = live[0];
        const paidUntil = current
          ? current.status === "trialing"
            ? current.trial_ends_at
            : current.current_period_end
          : null;
        const start =
          paidUntil && paidUntil.getTime() > input.now.getTime()
            ? paidUntil
            : input.now;
        const periodEnd = addMonths(start, p.interval_months);
        let subscriptionId: string;
        if (current) {
          subscriptionId = current.id;
          // Un paiement ponctuel (sans abonnement chez le fournisseur) ne remplace
          // pas un abonnement récurrent en cours : sinon Stripe continuerait de
          // prélever, et la résiliation dans Wema ne l'atteindrait plus. Un abonnement
          // déjà résilié, lui, est remplacé (sa fin chez Stripe ne doit pas couper la période payée).
          await tx.query(
            `UPDATE subscriptions SET status = 'active', offer_id = $2, payer_id = $3,
               provider = CASE WHEN $5::text IS NULL AND external_id IS NOT NULL
                 AND status IN ('active', 'past_due') THEN provider ELSE $4 END,
               external_id = CASE WHEN $5::text IS NULL AND status IN ('active', 'past_due')
                 THEN external_id ELSE $5 END,
               current_period_end = $6, updated_at = $7
             WHERE id = $1`,
            [
              current.id,
              p.offer_id,
              p.payer_id,
              p.provider,
              input.externalSubscriptionId,
              periodEnd,
              input.now,
            ],
          );
        } else {
          subscriptionId = randomUUID();
          await tx.query(
            `INSERT INTO subscriptions (id, learner_id, subject_id, offer_id, payer_id, provider, status,
               current_period_end, external_id, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $8, $9, $9)`,
            [
              subscriptionId,
              p.learner_id,
              p.subject_id,
              p.offer_id,
              p.payer_id,
              p.provider,
              periodEnd,
              input.externalSubscriptionId,
              input.now,
            ],
          );
        }
        await tx.query(
          "UPDATE payments SET subscription_id = $2 WHERE id = $1",
          [input.paymentId, subscriptionId],
        );
        return { applied: true, subscriptionId };
      });
    },

    async markPaymentFailed(paymentId: string): Promise<boolean> {
      const { rows } = await db.query(
        "UPDATE payments SET status = 'failed' WHERE id = $1 AND status = 'pending' RETURNING id",
        [paymentId],
      );
      return rows.length > 0;
    },

    /**
     * Renouvellement payé chez le fournisseur (facture Stripe) : un paiement
     * est enregistré une seule fois par référence, et l'échéance avancée.
     */
    async applyRenewal(input: {
      subscription: Subscription;
      externalId: string;
      amountMinor: number;
      currency: string;
      periodEnd: Date | null;
      now: Date;
    }): Promise<boolean> {
      return db.transaction(async (tx) => {
        const offer = await createBillingStore(tx).getOffer(
          input.subscription.offerId,
        );
        const intervalMonths = offer?.intervalMonths ?? 1;
        const { rows } = await tx.query(
          `INSERT INTO payments (id, subscription_id, learner_id, subject_id, offer_id, payer_id, provider,
             method, kind, amount_minor, currency, interval_months, status, external_id, created_at, paid_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'card', 'renewal', $8, $9, $10, 'succeeded', $11, $12, $12)
           ON CONFLICT DO NOTHING RETURNING id`,
          [
            randomUUID(),
            input.subscription.id,
            input.subscription.learnerId,
            input.subscription.subjectId,
            input.subscription.offerId,
            input.subscription.payerId,
            input.subscription.provider ?? "stripe",
            input.amountMinor,
            input.currency,
            intervalMonths,
            input.externalId,
            input.now,
          ],
        );
        if (rows.length === 0) return false;
        const base =
          input.subscription.currentPeriodEnd &&
          input.subscription.currentPeriodEnd > input.now
            ? input.subscription.currentPeriodEnd
            : input.now;
        const periodEnd = input.periodEnd ?? addMonths(base, intervalMonths);
        await tx.query(
          `UPDATE subscriptions SET current_period_end = GREATEST(COALESCE(current_period_end, $2), $2),
             status = CASE WHEN status IN ('past_due', 'active') THEN 'active' ELSE status END,
             updated_at = $3
           WHERE id = $1`,
          [input.subscription.id, periodEnd, input.now],
        );
        return true;
      });
    },

    // Webhooks -------------------------------------------------------------------

    /** Note un événement reçu ; faux s'il avait déjà été traité (envoi rejoué). */
    async recordEvent(
      provider: PaymentProviderName,
      eventId: string,
      type: string,
    ): Promise<boolean> {
      const { rows } = await db.query(
        `INSERT INTO payment_events (provider, event_id, type) VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING RETURNING event_id`,
        [provider, eventId, type],
      );
      return rows.length > 0;
    },

    // Contrats -------------------------------------------------------------------

    async listContractOrganizations(): Promise<ContractOrganization[]> {
      const { rows } = await db.query<{
        id: string;
        name: string;
        kind: "school" | "tutoring";
        under_contract: boolean;
      }>(
        "SELECT id, name, kind, under_contract FROM organizations WHERE kind IN ('school', 'tutoring') ORDER BY name",
      );
      return rows.map((r) => ({
        id: asOrganizationId(r.id),
        name: r.name,
        kind: r.kind,
        underContract: r.under_contract,
      }));
    },

    /** Pose ou retire le statut « sous contrat » (écoles et réseaux de profs seulement). */
    async setUnderContract(
      organizationId: OrganizationId,
      underContract: boolean,
    ): Promise<boolean> {
      const { rows } = await db.query(
        `UPDATE organizations SET under_contract = $2
         WHERE id = $1 AND kind IN ('school', 'tutoring') RETURNING id`,
        [organizationId, underContract],
      );
      return rows.length > 0;
    },
  };
  return store;
}

export type BillingStore = ReturnType<typeof createBillingStore>;
