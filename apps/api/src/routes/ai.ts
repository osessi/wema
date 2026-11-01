import { zValidator } from "@hono/zod-validator";
import { AI_TASKS, DEFAULT_ROUTING, parseAiRouting } from "@wema/ai-gateway";
import {
  createAiCallLog,
  createAuditLog,
  createOrganizationStore,
  createSettingsStore,
} from "@wema/db";
import { Hono } from "hono";
import { z } from "zod";
import { AI_ROUTING_KEY, currentRouting } from "../ai-setup";
import type { Deps, Env } from "../context";
import { fail, requirePermission, requireSession } from "../http";

const modelsResponse = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      name: z.string().optional(),
      context_length: z.number().nullable().optional(),
      pricing: z
        .object({
          prompt: z.string().optional(),
          completion: z.string().optional(),
        })
        .partial()
        .optional(),
    }),
  ),
});

/** Réglages de la passerelle IA et coûts : réservés à l'équipe Wema (ai.manage). */
export function aiRoutes(deps: Deps) {
  let modelsCache: { at: number; models: unknown[] } | null = null;

  return new Hono<Env>()
    .use(requireSession(deps), requirePermission("ai.manage"))
    .get("/routing", async (c) =>
      c.json(
        {
          routing: await currentRouting(deps.db),
          defaults: DEFAULT_ROUTING,
          tasks: AI_TASKS,
          configured: deps.openRouterKey !== null,
        },
        200,
      ),
    )
    .put("/routing", async (c) => {
      const body: unknown = await c.req.json().catch(() => null);
      const parsed = parseAiRouting(body);
      if (!parsed.ok)
        return fail(c, 422, "invalid_routing", parsed.error.issues);
      const actor = c.get("user").id;
      await deps.db.transaction(async (tx) => {
        await createSettingsStore(tx).set(AI_ROUTING_KEY, parsed.value, actor);
        const platform =
          await createOrganizationStore(tx).getPlatformOrganization();
        await createAuditLog(tx).append({
          actorId: actor,
          organizationId: platform?.id ?? null,
          action: "ai.routing.update",
          targetType: "settings",
          targetId: AI_ROUTING_KEY,
          details: { ...parsed.value },
        });
      });
      return c.json({ ok: true, routing: parsed.value });
    })
    .get(
      "/usage",
      zValidator(
        "query",
        z.object({
          from: z.iso.datetime({ offset: true }).optional(),
          to: z.iso.datetime({ offset: true }).optional(),
          groupBy: z.enum(["task", "model", "organization"]).default("task"),
        }),
      ),
      async (c) => {
        const q = c.req.valid("query");
        const to = q.to ? new Date(q.to) : deps.now();
        const from = q.from
          ? new Date(q.from)
          : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
        const rows = await createAiCallLog(deps.db).usage({
          from,
          to,
          groupBy: q.groupBy,
        });
        const total = rows.reduce((sum, r) => sum + r.costUsd, 0);
        return c.json(
          {
            from: from.toISOString(),
            to: to.toISOString(),
            groupBy: q.groupBy,
            totalCostUsd: total,
            rows,
          },
          200,
        );
      },
    )
    .get("/models", async (c) => {
      // Liste des modèles d'OpenRouter, pour choisir le routage ; gardée 10 minutes.
      if (!deps.openRouterKey) return fail(c, 503, "ai_not_configured");
      if (modelsCache && Date.now() - modelsCache.at < 10 * 60 * 1000)
        return c.json({ models: modelsCache.models }, 200);
      try {
        const res = await fetch("https://openrouter.ai/api/v1/models", {
          headers: { authorization: `Bearer ${deps.openRouterKey}` },
          signal: AbortSignal.timeout(15_000),
        });
        const parsed = modelsResponse.safeParse(await res.json());
        if (!res.ok || !parsed.success) return fail(c, 502, "ai_unavailable");
        const models = parsed.data.data.map((m) => ({
          id: m.id,
          name: m.name ?? m.id,
          contextLength: m.context_length ?? null,
          promptPrice: m.pricing?.prompt ?? null,
          completionPrice: m.pricing?.completion ?? null,
        }));
        modelsCache = { at: Date.now(), models };
        return c.json({ models }, 200);
      } catch {
        return fail(c, 502, "ai_unavailable");
      }
    });
}
