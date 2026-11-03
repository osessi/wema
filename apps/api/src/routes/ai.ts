import { zValidator } from "@hono/zod-validator";
import {
  AI_TASKS,
  type AiModelInfo,
  DEFAULT_ROUTING,
  parseAiRouting,
} from "@wema/ai-gateway";
import {
  createAiCallLog,
  createAuditLog,
  createOrganizationStore,
  createSettingsStore,
} from "@wema/db";
import { Hono } from "hono";
import { z } from "zod";
import { AI_ROUTING_KEY, storedRouting } from "../ai-setup";
import type { Deps, Env } from "../context";
import { fail, requirePermission, requireSession } from "../http";

/** Réglages de la passerelle IA et coûts : réservés à l'équipe Wema (ai.manage). */
export function aiRoutes(deps: Deps) {
  let modelsCache: { at: number; models: AiModelInfo[] } | null = null;

  return new Hono<Env>()
    .use(requireSession(deps), requirePermission("ai.manage"))
    .get("/routing", async (c) => {
      const stored = await storedRouting(deps.db);
      return c.json(
        {
          routing: stored.routing,
          // Un réglage stocké devenu invalide est signalé : la passerelle utilise alors le routage par défaut.
          storedInvalid: stored.invalid !== null,
          issues: stored.invalid ?? [],
          defaults: DEFAULT_ROUTING,
          tasks: AI_TASKS,
          configured: deps.aiConfigured,
        },
        200,
      );
    })
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
        if (from.getTime() > to.getTime())
          return fail(c, 422, "invalid_period");
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
      // Modèles proposés par le fournisseur, pour choisir le routage ; gardés 10 minutes.
      if (!deps.aiConfigured) return fail(c, 503, "ai_not_configured");
      if (modelsCache && Date.now() - modelsCache.at < 10 * 60 * 1000) {
        return c.json({ models: modelsCache.models }, 200);
      }
      const models = await deps.ai.listModels();
      if (!models.ok) return fail(c, 502, "ai_unavailable");
      modelsCache = { at: Date.now(), models: models.value };
      return c.json({ models: models.value }, 200);
    });
}
