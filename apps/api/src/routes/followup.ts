import { zValidator } from "@hono/zod-validator";
import { createNudgeStore } from "@wema/db";
import { asLearnerId } from "@wema/domain";
import { Hono } from "hono";
import { z } from "zod";
import { accessGuard } from "../billing/access";
import type { Deps, Env } from "../context";
import { learnerNextActions, runFollowUp } from "../followup";
import { fail, requirePermission, requireSession } from "../http";

/** Suivi actif : prochaines actions et relances de l'élève ; passage manuel pour l'équipe Wema. */
export function followUpRoutes(deps: Deps) {
  const nudges = createNudgeStore(deps.db);
  return new Hono<Env>()
    .use(requireSession(deps))
    .get("/learner/next", async (c) => {
      const learnerId = asLearnerId(c.get("user").id);
      const { actions } = await learnerNextActions(
        deps.db,
        learnerId,
        deps.now(),
      );
      // Seulement les matières ouvertes (abonnement, essai ou contrat).
      const guard = accessGuard(
        deps.db,
        deps.billing.access,
        learnerId,
        deps.now(),
      );
      const open = [];
      for (const a of actions)
        if (!("notionId" in a) || (await guard.notion(a.notionId)))
          open.push(a);
      return c.json({ actions: open }, 200);
    })
    .get("/learner/nudges", async (c) => {
      const learnerId = asLearnerId(c.get("user").id);
      const guard = accessGuard(
        deps.db,
        deps.billing.access,
        learnerId,
        deps.now(),
      );
      const open = [];
      for (const n of await nudges.listForLearner(learnerId))
        if (!n.notionId || (await guard.notion(n.notionId))) open.push(n);
      return c.json({ nudges: open }, 200);
    })
    .post(
      "/learner/nudges/:id/read",
      zValidator("param", z.object({ id: z.uuid() })),
      async (c) => {
        const done = await nudges.markRead(
          c.req.valid("param").id,
          asLearnerId(c.get("user").id),
        );
        return done ? c.json({ ok: true }) : fail(c, 404, "not_found");
      },
    )
    .post(
      "/admin/followup/run",
      requirePermission("organizations.manage"),
      async (c) => {
        return c.json({
          ok: true,
          ...(await runFollowUp(
            deps.db,
            deps.ai,
            deps.now(),
            deps.billing.access,
          )),
        });
      },
    );
}
