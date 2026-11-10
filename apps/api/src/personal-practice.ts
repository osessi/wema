import {
  createAccountStore,
  createAuditLog,
  createExerciseStore,
  createOrganizationStore,
} from "@wema/db";
import { asUserId, type LearnerId, type OrganizationId } from "@wema/domain";
import { generateVariant, planVariant, seedFrom } from "@wema/exercises";
import { choosePersonalPractice } from "@wema/orchestrator";
import { accessGuard } from "./billing/access";
import type { Deps } from "./context";
import {
  type CurriculumCache,
  createCurriculumCache,
  followedPrograms,
  learnerNextActions,
} from "./followup";
import { collectiveHint } from "./routes/collective";
import { learnerModel, MAX_ATTEMPTS_PER_VARIANT } from "./routes/exercises";

/**
 * Exercice personnel d'un élève qui suit un programme individuel (fiche 0010) :
 * sans prof pour lui donner des exercices, Wema lui en prépare un, à la fois,
 * sur sa prochaine action (choix du cœur, `choosePersonalPractice`), parmi les
 * exercices validés de la bibliothèque Wema et de sa famille. La variante est
 * adaptée à son profil et vérifiée par services/math (AGENTS.md, règle 2).
 * Seulement sur une matière ouverte (abonnement, essai ou contrat).
 * Renvoie vrai si une variante a été créée.
 */
export async function preparePersonalPractice(
  deps: Pick<Deps, "db" | "math" | "billing" | "now">,
  learnerId: LearnerId,
  cache: CurriculumCache = createCurriculumCache(deps.db),
): Promise<boolean> {
  const individual = (await followedPrograms(deps.db, learnerId)).filter(
    (p) => p.source === "individual",
  );
  if (individual.length === 0) return false;
  const now = deps.now();
  const guard = accessGuard(deps.db, deps.billing.access, learnerId, now);
  const allowedNotions = new Set<string>();
  for (const p of individual) {
    if (!(await guard.subject(p.subjectId))) continue;
    for (const n of await cache.programNotions(p.programId))
      allowedNotions.add(n.id);
  }
  if (allowedNotions.size === 0) return false;

  const { actions } = await learnerNextActions(deps.db, learnerId, now, cache);
  const exercises = createExerciseStore(deps.db);
  const platform = await createOrganizationStore(
    deps.db,
  ).getPlatformOrganization();
  const memberships = await createAccountStore(deps.db).listMemberships(
    asUserId(learnerId),
  );
  const organizationIds: OrganizationId[] = [
    ...new Set([
      ...(platform ? [platform.id] : []),
      ...individual.map((p) => p.organizationId),
      ...memberships.map((m) => m.organizationId),
    ]),
  ];
  const intents = (
    await exercises.listIntents({ organizationIds, status: "validated" })
  ).filter((i) => allowedNotions.has(i.notionId));
  const used = new Map<string, number>();
  for (const v of await exercises.listVariantsForLearner(learnerId))
    used.set(v.intentId, (used.get(v.intentId) ?? 0) + 1);

  const choice = choosePersonalPractice({
    actions,
    intents,
    used,
    allowedNotions,
  });
  if (!choice) return false;
  const intent = intents.find((i) => i.id === choice.intentId);
  if (!intent) return false;

  const { model, settings } = await learnerModel(deps.db, learnerId);
  const variant = await generateVariant({
    intent,
    plan: planVariant(
      intent,
      model.notions[intent.notionId],
      settings,
      await collectiveHint(deps.db, intent.notionId),
    ),
    seed: seedFrom(`${learnerId}:${intent.id}:${model.eventCount}:personal`),
    verifier: deps.math,
  });
  // services/math indisponible ou exercice refusé : rien n'est servi.
  if (!variant.ok) return false;
  const v = variant.value;
  const organizationId = individual[0]?.organizationId ?? null;
  return deps.db.transaction(async (tx) => {
    // Deux pages ouvertes en même temps ne préparent pas deux exercices.
    await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `wema_personal_practice:${learnerId}`,
    ]);
    const store = createExerciseStore(tx);
    const open = await store.openVariantsForLearner({
      learnerId,
      maxAttempts: MAX_ATTEMPTS_PER_VARIANT,
    });
    if (open.length > 0) return false;
    const row = await store.createVariant({
      intentId: intent.id,
      learnerId,
      seed: v.seed,
      plan: {
        level: v.level,
        scaffolded: v.scaffolded,
        hintLevel: v.hintLevel,
      },
      parameters: v.parameters,
      statement: v.statement,
      rendered: v.rendered,
      steps: v.steps,
      answer: v.answer,
      verifiedAt: now,
    });
    await createAuditLog(tx).append({
      actorId: null,
      organizationId,
      action: "variant.create",
      targetType: "variant",
      targetId: row.id,
      details: { intentId: intent.id, learnerId, personal: true },
    });
    return true;
  });
}
