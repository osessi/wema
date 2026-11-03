import type { SqlExecutor } from "@wema/db";
import { err, ok, type Result } from "@wema/domain";
import { z } from "zod";
import { subscriptionAccess } from "./access";
import { createDevProvider } from "./dev";
import { createKkiapayProvider } from "./kkiapay";
import { createStripeProvider } from "./stripe";
import type { BillingDeps } from "./types";

const optional = z
  .string()
  .optional()
  .transform((v) => (v === undefined || v.trim() === "" ? undefined : v));

/** Variables d'environnement du paiement (documentées dans .env.example). */
const billingEnv = z.object({
  STRIPE_SECRET_KEY: optional,
  STRIPE_WEBHOOK_SECRET: optional,
  KKIAPAY_PUBLIC_KEY: optional,
  KKIAPAY_PRIVATE_KEY: optional,
  KKIAPAY_SECRET_KEY: optional,
  KKIAPAY_WEBHOOK_SECRET: optional,
  /** « true » : environnement de test de Kkiapay (sandbox). */
  KKIAPAY_SANDBOX: optional,
});

/**
 * Fournisseurs de paiement choisis au démarrage. Sans clé : faux fournisseur
 * en développement, moyen de paiement indisponible en production. En
 * production, une clé sans son secret de webhook est refusée (les
 * renouvellements et résiliations ne seraient jamais reçus).
 */
export function billingFromEnv(
  env: NodeJS.ProcessEnv,
  options: { db: SqlExecutor; production: boolean },
): Result<{ deps: BillingDeps; summary: string }, string> {
  const parsed = billingEnv.safeParse(env);
  if (!parsed.success) return err(z.prettifyError(parsed.error));
  const e = parsed.data;
  const problems: string[] = [];
  const dev = options.production ? null : createDevProvider();

  const stripe = e.STRIPE_SECRET_KEY
    ? createStripeProvider({ secretKey: e.STRIPE_SECRET_KEY })
    : null;
  if (stripe && !e.STRIPE_WEBHOOK_SECRET && options.production)
    problems.push(
      "STRIPE_WEBHOOK_SECRET est obligatoire avec STRIPE_SECRET_KEY.",
    );

  const kkiapayKeys = [
    e.KKIAPAY_PUBLIC_KEY,
    e.KKIAPAY_PRIVATE_KEY,
    e.KKIAPAY_SECRET_KEY,
  ];
  if (kkiapayKeys.some(Boolean) && !kkiapayKeys.every(Boolean))
    problems.push(
      "KKIAPAY_PUBLIC_KEY, KKIAPAY_PRIVATE_KEY et KKIAPAY_SECRET_KEY vont ensemble.",
    );
  const kkiapay =
    e.KKIAPAY_PUBLIC_KEY && e.KKIAPAY_PRIVATE_KEY && e.KKIAPAY_SECRET_KEY
      ? createKkiapayProvider({
          publicKey: e.KKIAPAY_PUBLIC_KEY,
          privateKey: e.KKIAPAY_PRIVATE_KEY,
          secretKey: e.KKIAPAY_SECRET_KEY,
          sandbox: e.KKIAPAY_SANDBOX === "true",
        })
      : null;
  // Des transactions de test du bac à sable ouvriraient un accès réel.
  if (e.KKIAPAY_SANDBOX === "true" && options.production)
    problems.push("KKIAPAY_SANDBOX=true est interdit en production.");
  if (kkiapay && !e.KKIAPAY_WEBHOOK_SECRET && options.production)
    problems.push(
      "KKIAPAY_WEBHOOK_SECRET est obligatoire avec les clés Kkiapay.",
    );
  if (problems.length > 0) return err(problems.join("\n"));

  const card = stripe ?? dev;
  const mobileMoney = kkiapay ?? dev;
  const providers: BillingDeps["providers"] = {};
  if (card) providers.card = card;
  if (mobileMoney) providers.mobile_money = mobileMoney;
  return ok({
    deps: {
      providers,
      stripeWebhookSecret: e.STRIPE_WEBHOOK_SECRET ?? null,
      kkiapayWebhookSecret: e.KKIAPAY_WEBHOOK_SECRET ?? null,
      kkiapay,
      access: subscriptionAccess(options.db),
    },
    summary: `carte : ${card?.name ?? "indisponible"}, Mobile Money : ${mobileMoney?.name ?? "indisponible"}`,
  });
}
