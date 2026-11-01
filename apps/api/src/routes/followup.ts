import { zValidator } from "@hono/zod-validator";
import { createNudgeStore } from "@wema/db";
import { asLearnerId } from "@wema/domain";
import { Hono } from "hono";
import { z } from "zod";
import type { Deps, Env } from "../context";
import { learnerNextActions, runFollowUp } from "../followup";
import { fail, requirePermission, requireSession } from "../http";
import { notionInfo } from "../tutor-context";

/** Suivi actif : prochaines actions et relances de l'élève ; passage manuel pour l'équipe Wema. */
export function followUpRoutes(deps: Deps) {
  const nudges = createNudgeStore(deps.db);
  return new Hono<Env>()
    .use(requireSession(deps))
    .get("/learner/next", async (c) => {
      const { actions } = await learnerNextActions(
        deps.db,
        asLearnerId(c.get("user").id),
        deps.now(),
      );
      const named = await Promise.all(
        actions.map(async (a) => ({
          ...a,
          notionName:
            "notionId" in a
              ? ((await notionInfo(deps.db, a.notionId))?.notion.name ?? null)
              : null,
        })),
      );
      return c.json({ actions: named }, 200);
    })
    .get("/learner/nudges", async (c) => {
      return c.json(
        { nudges: await nudges.listForLearner(asLearnerId(c.get("user").id)) },
        200,
      );
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
          ...(await runFollowUp(deps.db, deps.ai, deps.now())),
        });
      },
    );
}
