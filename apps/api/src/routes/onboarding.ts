import {
  createBillingStore,
  createClassStore,
  createDiagnosticStore,
  createLearnerProgramStore,
  createPlacementStore,
  type SqlExecutor,
} from "@wema/db";
import {
  asLearnerId,
  asUserId,
  diagnosticEligibility,
  type LearnerId,
} from "@wema/domain";
import { Hono } from "hono";
import type { Deps, Env } from "../context";
import { requireSession } from "../http";

/** Premiers pas d'un élève : test de niveau (au moins une matière), puis entretien. */
async function learnerFirstSteps(db: SqlExecutor, learnerId: LearnerId) {
  const [tests, intake] = await Promise.all([
    createPlacementStore(db).list(learnerId),
    db.query(
      "SELECT 1 FROM learning_events WHERE learner_id = $1 AND type = 'intake.completed' LIMIT 1",
      [learnerId],
    ),
  ]);
  return {
    placementDone: tests.some((t) => t.completedAt !== null),
    intakeDone: intake.rows.length > 0,
  };
}

/**
 * Où en sont l'élève et la famille dans leurs premiers pas : l'accueil de
 * l'élève propose ce qui manque, la liste de démarrage du parent montre les
 * étapes restantes. Rien n'est bloqué : ce sont des indications.
 */
export function onboardingRoutes(deps: Deps) {
  const classes = createClassStore(deps.db);
  const programs = createLearnerProgramStore(deps.db);
  const billing = createBillingStore(deps.db);
  const diagnostics = createDiagnosticStore(deps.db);

  return new Hono<Env>()
    .use(requireSession(deps))
    .get("/learner", async (c) =>
      c.json(
        await learnerFirstSteps(deps.db, asLearnerId(c.get("user").id)),
        200,
      ),
    )
    .get("/family", async (c) => {
      const now = deps.now();
      const hasFamily = c
        .get("memberships")
        .some(
          (m) =>
            m.organizationKind === "family" &&
            m.permissions.includes("members.manage"),
        );
      const kids = await classes.childrenOf(c.get("user").id);
      const appointments = await diagnostics.listForLearners(
        kids.map((k) => k.learnerId),
      );
      const children = [];
      for (const k of kids) {
        const [list, subscriptions, contract, steps] = await Promise.all([
          programs.programsOf(k.learnerId),
          billing.listSubscriptions({ learnerIds: [k.learnerId] }),
          billing.underContract(k.learnerId),
          learnerFirstSteps(deps.db, k.learnerId),
        ]);
        const open = subscriptions.some(
          (s) =>
            (s.status === "trialing" &&
              s.trialEndsAt !== null &&
              s.trialEndsAt > now) ||
            (s.status !== "trialing" &&
              s.status !== "ended" &&
              s.currentPeriodEnd !== null &&
              s.currentPeriodEnd > now),
        );
        const mine = appointments.filter(
          (a) => a.learnerId === asUserId(k.learnerId),
        );
        const current = mine.find((a) => a.status !== "cancelled");
        children.push({
          learnerId: k.learnerId,
          displayName: k.displayName,
          organizationId: k.organizationId,
          hasProgram: list.length > 0,
          ...steps,
          access: contract ? "contract" : open ? "subscription" : null,
          diagnostic: {
            eligibility: diagnosticEligibility({
              subscriptions,
              appointments: mine,
              now,
            }),
            status: current?.status ?? null,
            startsAt: current?.startsAt ?? null,
          },
        });
      }
      return c.json({ hasFamily, children }, 200);
    });
}
