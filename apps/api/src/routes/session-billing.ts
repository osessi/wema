import { zValidator } from "@hono/zod-validator";
import {
  createAgendaStore,
  createAuditLog,
  createBillingStore,
  createCurriculumStore,
  createSessionBillingStore,
  PAYMENT_METHODS,
  type PaymentMethod,
  type SqlExecutor,
} from "@wema/db";
import { asCountryId, asLearnerId, type UserId } from "@wema/domain";
import { Hono } from "hono";
import { z } from "zod";
import { canPay, sessionPriceFor } from "../billing/session-price";
import type { Deps, Env } from "../context";
import { fail, requirePermission, requireSession } from "../http";

const uuid = z.uuid();

const priceBody = z.object({
  currency: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .pipe(z.string().regex(/^[A-Z]{3}$/)),
  amountMinor: z.number().int().min(1).max(1_000_000_000),
  methods: z
    .array(z.enum(["card", "mobile_money"]))
    .max(PAYMENT_METHODS.length)
    .transform((m) => [...new Set(m)]),
});

/** Prix d'une séance réservée pour cet élève, ou null (gratuite). */
export async function bookingPrice(
  db: SqlExecutor,
  learnerId: string,
  via: "guardian" | "self",
) {
  if (via !== "guardian") return null;
  const prices = await createSessionBillingStore(db).listPrices();
  if (prices.length === 0) return null;
  const countries = await createBillingStore(db).countriesOfLearner(
    asLearnerId(learnerId),
  );
  return sessionPriceFor(prices, countries, via);
}

/**
 * Séance supplémentaire payante : l'équipe Wema fixe un prix par pays
 * (aucun par défaut) ; le parent règle la séance qu'il a réservée par le
 * même fournisseur que les abonnements, et la séance est confirmée au paiement.
 */
export function sessionBillingRoutes(deps: Deps) {
  const prices = createSessionBillingStore(deps.db);
  const agenda = createAgendaStore(deps.db);

  const trace = (
    db: SqlExecutor,
    actorId: UserId,
    action: string,
    targetId: string,
    details: Record<string, unknown>,
  ) =>
    createAuditLog(db).append({
      actorId,
      organizationId: null,
      action,
      targetType: "session_price",
      targetId,
      details,
    });

  /** Le parent qui réserve pour cet enfant chez ce prof (lien encore valable). */
  const guardianOf = async (userId: UserId, sessionId: string) => {
    const s = await agenda.getSession(sessionId);
    if (s?.kind !== "individual" || !s.learnerId) return null;
    const ok = (await agenda.bookable(userId)).some(
      (b) =>
        b.via === "guardian" &&
        b.teacherId === s.teacherId &&
        b.learnerId === s.learnerId,
    );
    return ok ? s : null;
  };

  return (
    new Hono<Env>()
      .use(requireSession(deps))
      // ---------- Back-office : prix d'une séance par pays ----------
      .get(
        "/admin/billing/session-prices",
        requirePermission("organizations.manage"),
        async (c) =>
          c.json(
            {
              prices: await prices.listPrices(),
              countries: (await createCurriculumStore(deps.db).listCountries())
                .filter((k) => !k.archived)
                .map((k) => ({ id: k.id, name: k.name })),
            },
            200,
          ),
      )
      .put(
        "/admin/billing/session-prices/:countryId",
        requirePermission("organizations.manage"),
        zValidator("param", z.object({ countryId: uuid })),
        zValidator("json", priceBody),
        async (c) => {
          const countryId = asCountryId(c.req.valid("param").countryId);
          const body = c.req.valid("json");
          const done = await deps.db.transaction(async (tx) => {
            const saved = await createSessionBillingStore(tx).setPrice({
              countryId,
              ...body,
              now: deps.now(),
            });
            if (saved)
              await trace(
                tx,
                c.get("user").id,
                "session_price.set",
                countryId,
                body,
              );
            return saved;
          });
          if (!done) return fail(c, 404, "not_found");
          return c.json({ ok: true }, 200);
        },
      )
      .delete(
        "/admin/billing/session-prices/:countryId",
        requirePermission("organizations.manage"),
        zValidator("param", z.object({ countryId: uuid })),
        async (c) => {
          const countryId = asCountryId(c.req.valid("param").countryId);
          const done = await deps.db.transaction(async (tx) => {
            const removed =
              await createSessionBillingStore(tx).removePrice(countryId);
            if (removed)
              await trace(
                tx,
                c.get("user").id,
                "session_price.remove",
                countryId,
                {},
              );
            return removed;
          });
          if (!done) return fail(c, 404, "not_found");
          return c.json({ ok: true }, 200);
        },
      )
      // ---------- Parent : payer une séance réservée ----------
      .post(
        "/agenda/sessions/:id/checkout",
        zValidator("param", z.object({ id: uuid })),
        zValidator(
          "json",
          z.object({ method: z.enum(["card", "mobile_money"]) }),
        ),
        async (c) => {
          const user = c.get("user");
          const s = await guardianOf(user.id, c.req.valid("param").id);
          if (!s) return fail(c, 404, "not_found");
          const charge = await prices.getCharge(s.id);
          const now = deps.now();
          if (
            !canPay({ charge, status: s.status, endsAt: s.endsAt, now }) ||
            !charge
          )
            return fail(c, 409, "payment_not_due");
          const { method } = c.req.valid("json");
          const provider = deps.billing.providers[method];
          if (!charge.methods.includes(method) || !provider)
            return fail(c, 422, "method_unavailable");
          const payment = await prices.createPayment({
            charge,
            payerId: user.id,
            provider: provider.name,
            method,
            now,
          });
          const back = `${deps.appUrl}/parent/agenda/seances/${s.id}`;
          const started = await provider.start({
            paymentId: payment.id,
            amountMinor: payment.amountMinor,
            currency: payment.currency,
            intervalMonths: 1,
            oneTime: true,
            description: `Wema · séance avec ${s.teacherName}`,
            returnUrl: `${back}?paiement=${payment.id}`,
            cancelUrl: `${back}?annule=1`,
          });
          if (!started.ok) {
            await prices.markPaymentFailed(payment.id);
            console.error(
              `Paiement de séance : démarrage refusé (${started.error.reason})`,
            );
            return started.error.reason === "currency_unsupported"
              ? fail(c, 422, "method_unavailable")
              : fail(c, 502, "payment_provider_failed");
          }
          if (started.value.kind === "redirect" && started.value.externalId)
            await prices.setPaymentExternal(
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
        "/agenda/session-payments/:id/confirm",
        zValidator("param", z.object({ id: uuid })),
        zValidator(
          "json",
          z.object({ transactionId: z.string().min(1).max(200).optional() }),
        ),
        async (c) => {
          const payment = await prices.getPayment(c.req.valid("param").id);
          if (!payment || payment.payerId !== c.get("user").id)
            return fail(c, 404, "not_found");
          if (payment.status !== "pending")
            return c.json({ ok: true, status: payment.status }, 200);
          const provider = deps.billing.providers[payment.method];
          if (!provider || provider.name !== payment.provider)
            return fail(c, 422, "method_unavailable");
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
              `Paiement de séance : vérification refusée (${checked.error.reason})`,
            );
            return checked.error.reason.endsWith("_mismatch")
              ? fail(c, 409, "payment_mismatch")
              : fail(c, 502, "payment_provider_failed");
          }
          if (checked.value.status === "succeeded") {
            try {
              await prices.applyPaymentSuccess({
                paymentId: payment.id,
                externalId:
                  checked.value.externalId ??
                  `${payment.provider}_${payment.id}`,
                now: deps.now(),
              });
            } catch (e) {
              // Une transaction du fournisseur ne paie qu'un seul paiement.
              if (
                typeof e === "object" &&
                e !== null &&
                "code" in e &&
                e.code === "23505"
              )
                return fail(c, 409, "transaction_already_used");
              throw e;
            }
          } else if (checked.value.status === "failed") {
            await prices.markPaymentFailed(payment.id);
          }
          const after = await prices.getPayment(payment.id);
          return c.json(
            {
              ok: true,
              status: after?.status ?? "pending",
              sessionId: payment.sessionId,
            },
            200,
          );
        },
      )
  );
}

/** Moyens de paiement d'une séance réellement disponibles sur ce serveur. */
export function usableMethodsFor(
  deps: Deps,
  methods: readonly PaymentMethod[],
): PaymentMethod[] {
  return methods.filter((m) => deps.billing.providers[m] !== undefined);
}
