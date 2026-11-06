import { createBillingStore, type SqlExecutor } from "@wema/db";
import type { LearnerId, NotionId, SubjectId } from "@wema/domain";
import type { Context } from "hono";
import { fail } from "../http";
import type { AccessPolicy } from "./types";

/**
 * Droits d'accès réels : une matière est ouverte si l'élève appartient à une
 * organisation sous contrat, ou s'il a un abonnement payé ou un essai en cours
 * pour cette matière.
 */
export function subscriptionAccess(db: SqlExecutor): AccessPolicy {
  const billing = createBillingStore(db);
  return {
    subjectAccess: (learnerId, subjectId, now) =>
      billing.accessSource(learnerId, subjectId, now),
  };
}

/** Tout est ouvert : pour les tests qui ne portent pas sur le paiement. */
export const openAccess: AccessPolicy = {
  subjectAccess: async () => "open",
};

/** Où le parent ouvre l'accès d'une matière (renvoyé à l'élève avec le refus). */
export const SUBSCRIBE_PATH = "/parent/abonnements";

/**
 * Refus clair : la matière n'est pas ouverte. L'élève voit un message, et le
 * lien vers la page où son parent peut l'abonner.
 */
export const subscriptionRequired = (c: Context) =>
  fail(c, 402, "subscription_required", { subscribePath: SUBSCRIBE_PATH });

/**
 * Contrôle d'accès d'une requête : par matière ou par notion (la matière est
 * celle du programme de la notion). Les réponses sont gardées le temps de la
 * requête.
 */
export function accessGuard(
  db: SqlExecutor,
  policy: AccessPolicy,
  learnerId: LearnerId,
  now: Date,
) {
  const billing = createBillingStore(db);
  const bySubject = new Map<string, Promise<boolean>>();
  const byNotion = new Map<string, Promise<boolean>>();
  const subject = (subjectId: SubjectId) => {
    let found = bySubject.get(subjectId);
    if (!found) {
      found = policy
        .subjectAccess(learnerId, subjectId, now)
        .then((source) => source !== null);
      bySubject.set(subjectId, found);
    }
    return found;
  };
  const notion = (notionId: NotionId) => {
    let found = byNotion.get(notionId);
    if (!found) {
      found = billing
        .subjectOfNotion(notionId)
        .then((s) => (s ? subject(s) : false));
      byNotion.set(notionId, found);
    }
    return found;
  };
  return { subject, notion };
}
