import { zValidator } from "@hono/zod-validator";
import {
  createAuditLog,
  createBillingStore,
  createClassStore,
  createCurriculumStore,
  type Offer,
  PAYMENT_METHODS,
  type PaymentMethod,
  type SqlExecutor,
  type Subscription,
} from "@wema/db";
import {
  asCountryId,
  asLearnerId,
  asOrganizationId,
  asSubjectId,
  type OrganizationId,
} from "@wema/domain";
import { type Context, Hono } from "hono";
import { z } from "zod";
import { SUBSCRIBE_PATH } from "../billing/access";
import { pickString } from "../billing/json";
import { verifyKkiapaySecret } from "../billing/kkiapay";
import { applyBillingEvent } from "../billing/service";
import { parseStripeEvent, verifyStripeSignature } from "../billing/stripe";
import type { PaymentProvider } from "../billing/types";
import type { Deps, Env } from "../context";
import { fail, requirePermission, requireSession } from "../http";

const uuid = z.uuid();
const methodSchema = z.enum(["card", "mobile_money"]);
const DAY_MS = 24 * 60 * 60 * 1000;

const offerFields = z.object({
  currency: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .pipe(z.string().regex(/^[A-Z]{3}$/)),
  amountMinor: z.number().int().min(1).max(1_000_000_000),
  intervalMonths: z.number().int().min(1).max(12),
  trialDays: z.number().int().min(0).max(90),
  methods: z
    .array(methodSchema)
    .max(PAYMENT_METHODS.length)
    .transform((m) => [...new Set(m)]),
  active: z.boolean(),
});

/** Accès ouvert à la date donnée (même règle que la base, pour l'affichage). */
export function isOpen(s: Subscription, now: Date): boolean {
  if (s.status === "trialing") return (s.trialEndsAt ?? now) > now;
  if (s.status === "ended") return false;
  return (s.currentPeriodEnd ?? now) > now;
}

const subscriptionView = (s: Subscription, now: Date) => ({
  id: s.id,
  learnerId: s.learnerId,
  learnerName: s.learnerName,
  subjectId: s.subjectId,
  subjectName: s.subjectName,
  offerId: s.offerId,
  payerName: s.payerName,
  provider: s.provider,
  status: s.status,
  trialEndsAt: s.trialEndsAt?.toISOString() ?? null,
  currentPeriodEnd: s.currentPeriodEnd?.toISOString() ?? null,
  createdAt: s.createdAt.toISOString(),
  open: isOpen(s, now),
  /** Résiliable : en cours, et pas déjà résilié. */
  cancelable: isOpen(s, now) && s.status !== "canceled",
});

const offerView = (o: Offer) => ({
  id: o.id,
  countryId: o.countryId,
  countryName: o.countryName,
  subjectId: o.subjectId,
  subjectName: o.subjectName,
  currency: o.currency,
  amountMinor: o.amountMinor,
  intervalMonths: o.intervalMonths,
  trialDays: o.trialDays,
  methods: o.methods,
  active: o.active,
});

const pgCode = (e: unknown) =>
  typeof e === "object" && e !== null && "code" in e ? e.code : null;

/**
 * Webhooks des fournisseurs : sans session, authentifiés par signature (Stripe)
 * ou secret partagé (Kkiapay), puis vérifiés auprès du fournisseur. Un
 * événement déjà traité (envoi rejoué) est accusé sans être réappliqué.
 */
export function billingWebhookRoutes(deps: Deps) {
  return new Hono<Env>()
    .post("/stripe", async (c) => {
      const secret = deps.billing.stripeWebhookSecret;
      if (!secret) return fail(c, 503, "webhook_not_configured");
      const payload = await c.req.text();
      if (
        !verifyStripeSignature({
          payload,
          header: c.req.header("stripe-signature"),
          secret,
          now: deps.now(),
        })
      )
        return fail(c, 400, "invalid_signature");
      let body: unknown;
      try {
        body = JSON.parse(payload);
      } catch {
        return fail(c, 400, "invalid_payload");
      }
      const parsed = parseStripeEvent(body);
      if (!parsed.id) return fail(c, 400, "invalid_payload");
      const eventId = parsed.id;
      const outcome = await deps.db.transaction(async (tx) => {
        if (
          !(await createBillingStore(tx).recordEvent(
            "stripe",
            eventId,
            parsed.type,
          ))
        )
          return "duplicate" as const;
        return applyBillingEvent(tx, parsed.event, deps.now());
      });
      return c.json({ received: true, outcome }, 200);
    })
    .post("/kkiapay", async (c) => {
      const secret = deps.billing.kkiapayWebhookSecret;
      const kkiapay = deps.billing.kkiapay;
      if (!secret || !kkiapay) return fail(c, 503, "webhook_not_configured");
      if (!verifyKkiapaySecret(c.req.header("x-kkiapay-secret"), secret))
        return fail(c, 401, "invalid_signature");
      const body: unknown = await c.req.json().catch(() => null);
      const transactionId = pickString(body, "transactionId");
      if (!transactionId) return fail(c, 400, "invalid_payload");
      // Le corps n'est qu'une annonce : l'état vient de l'API de Kkiapay.
      const tx = await kkiapay.transaction(transactionId);
      if (!tx.ok) return fail(c, 502, "payment_provider_failed");
      if (tx.value.status === "pending" || !tx.value.reference)
        return c.json({ received: true, outcome: "ignored" }, 200);
      const reference = tx.value.reference;
      const status = tx.value.status;
      const outcome = await deps.db.transaction(async (db) => {
        const billing = createBillingStore(db);
        if (
          !(await billing.recordEvent(
            "kkiapay",
            `${transactionId}:${status}`,
            status,
          ))
        )
          return "duplicate" as const;
        const payment = await billing.getPayment(reference);
        if (payment?.provider !== "kkiapay") return "unknown" as const;
        if (status === "failed")
          return applyBillingEvent(
            db,
            { kind: "payment_failed", paymentId: payment.id },
            deps.now(),
          );
        if (tx.value.amount !== payment.amountMinor) return "unknown" as const;
        return applyBillingEvent(
          db,
          {
            kind: "payment_succeeded",
            paymentId: payment.id,
            externalId: transactionId,
            externalSubscriptionId: null,
          },
          deps.now(),
        );
      });
      return c.json({ received: true, outcome }, 200);
    });
}

/** Espace parent (abonnements de ses enfants) et back-office (offres, contrats). */
export function billingRoutes(deps: Deps) {
  const billing = createBillingStore(deps.db);
  const classes = createClassStore(deps.db);

  const trace = (
    tx: SqlExecutor,
    c: Context<Env>,
    organizationId: OrganizationId | null,
    action: string,
    targetId: string,
    details: Record<string, unknown> = {},
  ) =>
    createAuditLog(tx).append({
      actorId: c.get("user").id,
      organizationId,
      action,
      targetType: action.split(".")[0] ?? action,
      targetId,
      details,
    });

  /** Enfants dont l'utilisateur est le parent (lien encore valable). */
  const childrenOf = (c: Context<Env>) => classes.childrenOf(c.get("user").id);
  const isChild = async (c: Context<Env>, learnerId: string) =>
    (await childrenOf(c)).some((k) => k.learnerId === learnerId);

  /** Moyens de paiement réellement disponibles (fournisseur configuré). */
  const availableMethods = (): PaymentMethod[] =>
    PAYMENT_METHODS.filter((m) => deps.billing.providers[m] !== undefined);

  const providerFor = (
    method: PaymentMethod,
    name: string,
  ): PaymentProvider | null => {
    const p = deps.billing.providers[method];
    return p && p.name === name ? p : null;
  };

  return (
    new Hono<Env>()
      .use(requireSession(deps))
      .get("/parent/billing", async (c) => {
        const now = deps.now();
        const children = await childrenOf(c);
        const ids = children.map((k) => k.learnerId);
        const subscriptions =
          ids.length > 0
            ? await billing.listSubscriptions({ learnerIds: ids })
            : [];
        const methods = availableMethods();
        const offers = (await billing.listOffers({ activeOnly: true })).map(
          (o) => ({
            ...offerView(o),
            // Seuls les moyens proposés par l'offre ET branchés sur ce serveur.
            methods: o.methods.filter((m) => methods.includes(m)),
          }),
        );
        const result = [];
        for (const k of children) {
          const own = subscriptions.filter((s) => s.learnerId === k.learnerId);
          result.push({
            learnerId: k.learnerId,
            displayName: k.displayName,
            countryIds: await billing.countriesOfLearner(k.learnerId),
            underContract: await billing.underContract(k.learnerId),
            subscriptions: own
              .filter((s) => s.status !== "ended")
              .map((s) => subscriptionView(s, now)),
            /** Matières déjà essayées ou souscrites : plus d'essai gratuit. */
            usedTrialSubjectIds: [...new Set(own.map((s) => s.subjectId))],
          });
        }
        const payments = await billing.listPayments({
          payerId: c.get("user").id,
          limit: 20,
        });
        return c.json(
          {
            children: result,
            offers,
            methods,
            payments: payments.map((p) => ({
              id: p.id,
              learnerName: p.learnerName,
              subjectName: p.subjectName,
              amountMinor: p.amountMinor,
              currency: p.currency,
              method: p.method,
              provider: p.provider,
              status: p.status,
              createdAt: p.createdAt.toISOString(),
              paidAt: p.paidAt?.toISOString() ?? null,
            })),
          },
          200,
        );
      })
      .post(
        "/parent/billing/trial",
        zValidator("json", z.object({ learnerId: uuid, offerId: uuid })),
        async (c) => {
          const body = c.req.valid("json");
          if (!(await isChild(c, body.learnerId)))
            return fail(c, 404, "not_found");
          const offer = await billing.getOffer(body.offerId);
          if (!offer?.active) return fail(c, 404, "not_found");
          const learnerId = asLearnerId(body.learnerId);
          if (
            offer.trialDays === 0 ||
            (await billing.hadSubscription(learnerId, offer.subjectId))
          )
            return fail(c, 409, "trial_unavailable");
          const now = deps.now();
          const id = await deps.db.transaction(async (tx) => {
            const created = await createBillingStore(tx).startTrial({
              learnerId,
              subjectId: offer.subjectId,
              offerId: offer.id,
              payerId: c.get("user").id,
              endsAt: new Date(now.getTime() + offer.trialDays * DAY_MS),
              now,
            });
            if (created)
              await trace(tx, c, null, "subscription.trial", created, {
                learnerId,
                subjectId: offer.subjectId,
                offerId: offer.id,
              });
            return created;
          });
          if (!id) return fail(c, 409, "trial_unavailable");
          return c.json({ ok: true, id }, 201);
        },
      )
      .post(
        "/parent/billing/checkout",
        zValidator(
          "json",
          z.object({ learnerId: uuid, offerId: uuid, method: methodSchema }),
        ),
        async (c) => {
          const body = c.req.valid("json");
          if (!(await isChild(c, body.learnerId)))
            return fail(c, 404, "not_found");
          const offer = await billing.getOffer(body.offerId);
          if (!offer?.active) return fail(c, 404, "not_found");
          const provider = deps.billing.providers[body.method];
          if (!offer.methods.includes(body.method) || !provider)
            return fail(c, 422, "method_unavailable");
          const learnerId = asLearnerId(body.learnerId);
          const now = deps.now();
          // Un abonnement récurrent (Stripe) en cours se renouvelle seul : pas de second.
          const live = await billing.liveSubscription(
            learnerId,
            offer.subjectId,
          );
          if (
            live?.provider === "stripe" &&
            live.externalId &&
            isOpen(live, now)
          )
            return fail(c, 409, "already_subscribed");
          const payment = await billing.createPayment({
            learnerId,
            subjectId: offer.subjectId,
            offer,
            payerId: c.get("user").id,
            provider: provider.name,
            method: body.method,
            now,
          });
          const started = await provider.start({
            paymentId: payment.id,
            amountMinor: payment.amountMinor,
            currency: payment.currency,
            intervalMonths: payment.intervalMonths,
            description: `Wema · ${offer.subjectName}`,
            returnUrl: `${deps.publicUrl}${SUBSCRIBE_PATH}/retour?paiement=${payment.id}`,
            cancelUrl: `${deps.publicUrl}${SUBSCRIBE_PATH}?annule=1`,
          });
          if (!started.ok) {
            await billing.markPaymentFailed(payment.id);
            console.error(
              `Paiement : démarrage refusé (${started.error.reason})`,
            );
            return fail(
              c,
              started.error.reason === "currency_unsupported" ? 422 : 502,
              started.error.reason === "currency_unsupported"
                ? "method_unavailable"
                : "payment_provider_failed",
            );
          }
          if (started.value.kind === "redirect" && started.value.externalId)
            await billing.setPaymentExternal(
              payment.id,
              started.value.externalId,
            );
          return c.json(
            { ok: true, paymentId: payment.id, next: started.value },
            201,
          );
        },
      )
      .post(
        "/parent/billing/payments/:id/confirm",
        zValidator("param", z.object({ id: uuid })),
        zValidator(
          "json",
          z.object({ transactionId: z.string().min(1).max(200).optional() }),
        ),
        async (c) => {
          const payment = await billing.getPayment(c.req.valid("param").id);
          if (!payment || payment.payerId !== c.get("user").id)
            return fail(c, 404, "not_found");
          if (payment.status !== "pending")
            return c.json({ ok: true, status: payment.status }, 200);
          const provider = providerFor(payment.method, payment.provider);
          if (!provider) return fail(c, 422, "method_unavailable");
          const transactionId = c.req.valid("json").transactionId;
          const checked = await provider.verify({
            id: payment.id,
            externalId: payment.externalId,
            amountMinor: payment.amountMinor,
            currency: payment.currency,
            ...(transactionId ? { transactionId } : {}),
          });
          if (!checked.ok) {
            console.error(
              `Paiement : vérification refusée (${checked.error.reason})`,
            );
            return fail(c, 502, "payment_provider_failed");
          }
          const now = deps.now();
          if (checked.value.status === "succeeded") {
            try {
              await applyBillingEvent(
                deps.db,
                {
                  kind: "payment_succeeded",
                  paymentId: payment.id,
                  externalId:
                    checked.value.externalId ??
                    `${payment.provider}_${payment.id}`,
                  externalSubscriptionId: checked.value.externalSubscriptionId,
                },
                now,
              );
            } catch (e) {
              // Une transaction du fournisseur ne paie qu'un seul paiement.
              if (pgCode(e) === "23505")
                return fail(c, 409, "transaction_already_used");
              throw e;
            }
          } else if (checked.value.status === "failed") {
            await billing.markPaymentFailed(payment.id);
          }
          const after = await billing.getPayment(payment.id);
          return c.json({ ok: true, status: after?.status ?? "pending" }, 200);
        },
      )
      .post(
        "/parent/billing/subscriptions/:id/cancel",
        zValidator("param", z.object({ id: uuid })),
        async (c) => {
          const subscription = await billing.getSubscription(
            c.req.valid("param").id,
          );
          if (!subscription || !(await isChild(c, subscription.learnerId)))
            return fail(c, 404, "not_found");
          const now = deps.now();
          if (
            subscription.status === "ended" ||
            subscription.status === "canceled"
          )
            return c.json({ ok: true, status: subscription.status }, 200);
          if (subscription.provider === "stripe" && subscription.externalId) {
            const stripe = providerFor("card", "stripe");
            if (!stripe?.cancelAtPeriodEnd)
              return fail(c, 422, "method_unavailable");
            const done = await stripe.cancelAtPeriodEnd(
              subscription.externalId,
            );
            if (!done.ok) return fail(c, 502, "payment_provider_failed");
          }
          // Un essai s'arrête tout de suite ; une période payée va jusqu'à son échéance.
          const status =
            subscription.status === "trialing" ? "ended" : "canceled";
          await deps.db.transaction(async (tx) => {
            await createBillingStore(tx).setSubscriptionStatus(
              subscription.id,
              status,
              now,
            );
            await trace(tx, c, null, "subscription.cancel", subscription.id, {
              learnerId: subscription.learnerId,
              subjectId: subscription.subjectId,
            });
          });
          return c.json({ ok: true, status }, 200);
        },
      )
      // Back-office : l'équipe Wema règle les offres et les contrats.
      .get(
        "/admin/billing/offers",
        requirePermission("organizations.manage"),
        async (c) => {
          const curriculum = createCurriculumStore(deps.db);
          return c.json(
            {
              offers: (await billing.listOffers()).map(offerView),
              countries: (await curriculum.listCountries())
                .filter((k) => !k.archived)
                .map((k) => ({ id: k.id, name: k.name })),
              subjects: (await curriculum.listSubjects())
                .filter((s) => !s.archived)
                .map((s) => ({ id: s.id, name: s.name })),
              methods: availableMethods(),
            },
            200,
          );
        },
      )
      .post(
        "/admin/billing/offers",
        requirePermission("organizations.manage"),
        zValidator(
          "json",
          offerFields.extend({ countryId: uuid, subjectId: uuid }),
        ),
        async (c) => {
          const body = c.req.valid("json");
          const created = await deps.db.transaction(async (tx) => {
            const result = await createBillingStore(tx).createOffer({
              ...body,
              countryId: asCountryId(body.countryId),
              subjectId: asSubjectId(body.subjectId),
            });
            if (result.ok)
              await trace(tx, c, null, "offer.create", result.id, body);
            return result;
          });
          if (!created.ok) return fail(c, 409, created.error.kind);
          return c.json({ ok: true, id: created.id }, 201);
        },
      )
      .patch(
        "/admin/billing/offers/:id",
        requirePermission("organizations.manage"),
        zValidator("param", z.object({ id: uuid })),
        zValidator("json", offerFields),
        async (c) => {
          const id = c.req.valid("param").id;
          const body = c.req.valid("json");
          const updated = await deps.db.transaction(async (tx) => {
            const result = await createBillingStore(tx).updateOffer(
              id,
              body,
              deps.now(),
            );
            if (result.ok) await trace(tx, c, null, "offer.update", id, body);
            return result;
          });
          if (!updated.ok)
            return fail(
              c,
              updated.error.kind === "not_found" ? 404 : 409,
              updated.error.kind,
            );
          return c.json({ ok: true, id }, 200);
        },
      )
      .get(
        "/admin/billing/subscriptions",
        requirePermission("organizations.manage"),
        async (c) => {
          const now = deps.now();
          return c.json(
            {
              subscriptions: (
                await billing.listSubscriptions({ limit: 200 })
              ).map((s) => subscriptionView(s, now)),
              payments: (await billing.listPayments({ limit: 200 })).map(
                (p) => ({
                  id: p.id,
                  learnerName: p.learnerName,
                  subjectName: p.subjectName,
                  payerName: p.payerName,
                  amountMinor: p.amountMinor,
                  currency: p.currency,
                  method: p.method,
                  provider: p.provider,
                  kind: p.kind,
                  status: p.status,
                  createdAt: p.createdAt.toISOString(),
                  paidAt: p.paidAt?.toISOString() ?? null,
                }),
              ),
            },
            200,
          );
        },
      )
      .get(
        "/admin/billing/contracts",
        requirePermission("organizations.manage"),
        async (c) =>
          c.json(
            { organizations: await billing.listContractOrganizations() },
            200,
          ),
      )
      .put(
        "/admin/billing/contracts/:id",
        requirePermission("organizations.manage"),
        zValidator("param", z.object({ id: uuid })),
        zValidator("json", z.object({ underContract: z.boolean() })),
        async (c) => {
          const id = asOrganizationId(c.req.valid("param").id);
          const { underContract } = c.req.valid("json");
          const done = await deps.db.transaction(async (tx) => {
            const changed = await createBillingStore(tx).setUnderContract(
              id,
              underContract,
            );
            if (changed)
              await trace(tx, c, id, "organization.contract", id, {
                underContract,
              });
            return changed;
          });
          if (!done) return fail(c, 404, "not_found");
          return c.json({ ok: true }, 200);
        },
      )
  );
}
