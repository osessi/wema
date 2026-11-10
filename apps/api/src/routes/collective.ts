import { zValidator } from "@hono/zod-validator";
import {
  COLLECTIVE_MIN_LEARNERS,
  createAuditLog,
  createCollectiveStore,
  createOrganizationStore,
  type SqlExecutor,
  type StoredNotionInsight,
  scaffoldingGain,
} from "@wema/db";
import { Hono } from "hono";
import { z } from "zod";
import type { Deps, Env } from "../context";
import { allowed, fail, requirePermission, requireSession } from "../http";

/** Recalcul des agrégats collectifs (tâche périodique et bouton du back-office). */
export async function runCollectiveInsights(db: SqlExecutor, now: Date) {
  return createCollectiveStore(db).compute(now);
}

const serialize = (i: StoredNotionInsight) => ({
  ...i,
  computedAt: i.computedAt.toISOString(),
});

/**
 * Apprentissage collectif anonymisé : agrégats sur tous les élèves, sans
 * aucune donnée personnelle, publiés seulement pour des groupes d'au moins
 * COLLECTIVE_MIN_LEARNERS élèves.
 */
export function collectiveRoutes(deps: Deps) {
  const store = createCollectiveStore(deps.db);
  return (
    new Hono<Env>()
      .use(requireSession(deps))
      // Pour un prof : « ce qui marche ailleurs » sur les notions de sa classe.
      .get(
        "/notions",
        zValidator(
          "query",
          z.object({ ids: z.string().max(4000).default("") }),
        ),
        async (c) => {
          if (!allowed(c, "exercises.read")) return fail(c, 403, "forbidden");
          const ids = c.req
            .valid("query")
            .ids.split(",")
            .map((s) => s.trim())
            .filter((s) => z.uuid().safeParse(s).success)
            .slice(0, 100);
          const insights = await store.forNotions(ids);
          return c.json(
            {
              minLearners: COLLECTIVE_MIN_LEARNERS,
              insights: insights.map((i) => ({
                notionId: i.notionId,
                learners: i.learners,
                successRate: i.successRate,
                stuckRate: i.stuckRate,
                avgAnswersToSuccess: i.avgAnswersToSuccess,
                avgTutorSeconds: i.avgTutorSeconds,
                misconceptions: i.misconceptions,
                formats: i.formats,
                exercises: i.exercises,
              })),
            },
            200,
          );
        },
      )
      // Pour l'équipe Wema : tableau complet, par pays et matière.
      .get(
        "/",
        requirePermission("settings.pedagogy.manage"),
        zValidator(
          "query",
          z.object({
            countryId: z.uuid().optional(),
            subjectId: z.uuid().optional(),
          }),
        ),
        async (c) => {
          const q = c.req.valid("query");
          const [insights, computedAt] = await Promise.all([
            store.list({
              ...(q.countryId ? { countryId: q.countryId } : {}),
              ...(q.subjectId ? { subjectId: q.subjectId } : {}),
            }),
            store.lastComputedAt(),
          ]);
          return c.json(
            {
              minLearners: COLLECTIVE_MIN_LEARNERS,
              computedAt: computedAt?.toISOString() ?? null,
              insights: insights.map(serialize),
            },
            200,
          );
        },
      )
      .post(
        "/compute",
        requirePermission("settings.pedagogy.manage"),
        async (c) => {
          const result = await runCollectiveInsights(deps.db, deps.now());
          const platform = await createOrganizationStore(
            deps.db,
          ).getPlatformOrganization();
          await createAuditLog(deps.db).append({
            actorId: c.get("user").id,
            organizationId: platform?.id ?? null,
            action: "collective.compute",
            targetType: "collective_insights",
            targetId: "all",
            details: { ...result },
          });
          return c.json({ ok: true, ...result }, 200);
        },
      )
  );
}

/** Ce que le cœur lit des agrégats pour choisir la forme d'une variante (planVariant). */
export async function collectiveHint(
  db: SqlExecutor,
  notionId: string,
): Promise<{ scaffoldingGain: number | null }> {
  const [insight] = await createCollectiveStore(db).forNotions([notionId]);
  return { scaffoldingGain: scaffoldingGain(insight ?? null) };
}
