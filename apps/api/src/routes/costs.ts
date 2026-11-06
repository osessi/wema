import { zValidator } from "@hono/zod-validator";
import { ESSENTIAL_AI_TASKS, spendingLevel } from "@wema/ai-gateway";
import {
  createAiCallLog,
  createAiCostStore,
  createAuditLog,
  createOrganizationStore,
  monthStart,
} from "@wema/db";
import { asOrganizationId, type UserId } from "@wema/domain";
import { Hono } from "hono";
import { z } from "zod";
import type { Deps, Env } from "../context";
import { fail, requirePermission, requireSession } from "../http";

const DAY = 24 * 60 * 60 * 1000;

/** Coûts de l'IA et plafonds de dépense : réservés à l'équipe Wema (ai.manage). */
export function costRoutes(deps: Deps) {
  const audit = async (
    actorId: UserId,
    action: string,
    targetId: string,
    details: Record<string, unknown>,
  ) => {
    const platform = await createOrganizationStore(
      deps.db,
    ).getPlatformOrganization();
    await createAuditLog(deps.db).append({
      actorId,
      organizationId: platform?.id ?? null,
      action,
      targetType: "ai_spending_cap",
      targetId,
      details,
    });
  };

  return new Hono<Env>()
    .use(requireSession(deps), requirePermission("ai.manage"))
    .get(
      "/",
      zValidator(
        "query",
        z.object({
          from: z.iso.datetime({ offset: true }).optional(),
          to: z.iso.datetime({ offset: true }).optional(),
        }),
      ),
      async (c) => {
        const q = c.req.valid("query");
        const to = q.to ? new Date(q.to) : deps.now();
        const from = q.from
          ? new Date(q.from)
          : new Date(to.getTime() - 30 * DAY);
        if (from.getTime() > to.getTime())
          return fail(c, 422, "invalid_period");
        const period = { from, to };
        const costs = createAiCostStore(deps.db);
        const log = createAiCallLog(deps.db);
        const month = monthStart(deps.now());
        const [
          daily,
          byTask,
          byModel,
          byOrganization,
          learners,
          bySubject,
          caps,
          alerts,
          monthSpend,
        ] = await Promise.all([
          costs.daily(period),
          log.usage({ ...period, groupBy: "task" }),
          log.usage({ ...period, groupBy: "model" }),
          costs.byOrganization(period),
          costs.learnerSummary(period),
          costs.bySubject(period),
          costs.listCaps(),
          costs.listAlerts(new Date(month.getTime() - 92 * DAY)),
          costs.byOrganization({
            from: month,
            to: new Date(deps.now().getTime() + DAY),
          }),
        ]);
        const spentOf = (organizationId: string | null) =>
          organizationId === null
            ? monthSpend.reduce((s, r) => s + r.costUsd, 0)
            : (monthSpend.find((r) => r.organizationId === organizationId)
                ?.costUsd ?? 0);
        return c.json(
          {
            from: from.toISOString(),
            to: to.toISOString(),
            month: month.toISOString().slice(0, 7),
            totalCostUsd: byTask.reduce((s, r) => s + r.costUsd, 0),
            daily,
            byTask,
            byModel,
            byOrganization,
            learners,
            bySubject,
            essentialTasks: ESSENTIAL_AI_TASKS,
            caps: caps.map((cap) => {
              const spent = spentOf(cap.organizationId);
              return {
                ...cap,
                updatedAt: cap.updatedAt.toISOString(),
                spentUsd: spent,
                level: spendingLevel(spent, cap),
              };
            }),
            alerts: alerts.map((a) => ({ ...a, at: a.at.toISOString() })),
          },
          200,
        );
      },
    )
    .put(
      "/caps",
      zValidator(
        "json",
        z.object({
          organizationId: z.uuid().nullable(),
          monthlyUsd: z.number().min(0).max(1_000_000),
          alertRatio: z.number().min(0.1).max(1).default(0.8),
        }),
      ),
      async (c) => {
        const body = c.req.valid("json");
        if (body.organizationId !== null) {
          const org = await createOrganizationStore(deps.db).getOrganization(
            asOrganizationId(body.organizationId),
          );
          if (!org) return fail(c, 404, "not_found");
        }
        const actor = c.get("user").id;
        await createAiCostStore(deps.db).setCap({ ...body, updatedBy: actor });
        await audit(actor, "ai.cap.set", body.organizationId ?? "global", {
          ...body,
        });
        return c.json({ ok: true }, 200);
      },
    )
    .delete(
      "/caps",
      zValidator("query", z.object({ organizationId: z.uuid().optional() })),
      async (c) => {
        const organizationId = c.req.valid("query").organizationId ?? null;
        const removed = await createAiCostStore(deps.db).removeCap(
          organizationId,
        );
        if (!removed) return fail(c, 404, "not_found");
        await audit(
          c.get("user").id,
          "ai.cap.remove",
          organizationId ?? "global",
          {},
        );
        return c.json({ ok: true }, 200);
      },
    );
}
