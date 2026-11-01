import { randomUUID } from "node:crypto";
import { zValidator } from "@hono/zod-validator";
import {
  createAuditLog,
  createEventStore,
  createOrganizationStore,
  type SqlExecutor,
} from "@wema/db";
import {
  asEventId,
  asLearnerId,
  asOrganizationId,
  asUserId,
  isNeedKey,
  isPreferenceKey,
  type LearnerId,
  type LearningEvent,
  type LearningEventPayload,
  NEEDS,
} from "@wema/domain";
import { projectHypotheses } from "@wema/learner-model";
import { Hono } from "hono";
import { z } from "zod";
import type { Deps, Env } from "../context";
import { allowed, fail, requireSession } from "../http";
import { notionInfo } from "../tutor-context";
import { learnerModel } from "./exercises";

const uuid = z.uuid();
const preferenceBody = z.object({
  key: z.string().refine(isPreferenceKey, { message: "préférence inconnue" }),
  label: z.string().trim().min(1).max(80).nullable().default(null),
  value: z.boolean().default(true),
});
const needBody = z.object({
  need: z.string().refine(isNeedKey, { message: "besoin inconnu" }),
  active: z.boolean(),
  // Le consentement explicite du parent est exigé pour enregistrer une donnée de santé.
  consent: z.literal(true),
});

/**
 * Profil explicable d'un élève : chaque affirmation vient avec ses preuves
 * (règle n°4). Les besoins déclarés (données de santé) ne sont inclus que si
 * le lecteur y a droit.
 */
export async function explicableProfile(
  db: SqlExecutor,
  learnerId: LearnerId,
  withNeeds: boolean,
) {
  const { model, events } = await learnerModel(db, learnerId);
  const profile = projectHypotheses(events);
  const byId = new Map(events.map((e) => [e.id, e]));
  const answer = (e: LearningEvent | undefined) =>
    e && e.payload.type === "answer.submitted"
      ? {
          at: e.occurredAt,
          correct: e.payload.correct,
          response: e.payload.response,
          hintsUsed: e.payload.hintsUsed,
        }
      : null;

  const notions = [];
  for (const state of Object.values(model.notions)) {
    const info = await notionInfo(db, state.notionId);
    const descriptions = new Map(
      info?.misconceptions.map((m) => [m.id, m.description]) ?? [],
    );
    notions.push({
      notionId: state.notionId,
      name: info?.notion.name ?? null,
      subject: info?.subject.name ?? null,
      status: state.status,
      mastery: Math.round(state.pKnown * 100) / 100,
      observations: state.observations,
      // Les cinq dernières réponses : la preuve de l'état affiché.
      recentAnswers: state.evidence
        .slice(-5)
        .map((id) => answer(byId.get(id)))
        .filter((a) => a !== null),
      misconceptions: state.misconceptions
        .filter((m) => m.active)
        .map((m) => ({
          misconceptionId: m.misconceptionId,
          description: descriptions.get(m.misconceptionId) ?? null,
          occurrences: m.occurrences,
          evidence: m.evidence
            .map((id) => answer(byId.get(id)))
            .filter((a) => a !== null),
        })),
      assessments: profile.assessments
        .filter((a) => a.notionId === state.notionId)
        .map((a) => ({
          kind: a.kind,
          understanding: a.understanding,
          confidence: a.confidence,
          summary: a.summary,
        })),
    });
  }
  return {
    learnerId,
    notions,
    hypotheses: profile.hypotheses.map((h) => ({
      ...h,
      evidenceCount: h.evidence.length,
    })),
    ...(withNeeds
      ? {
          needs: profile.needs.map((n) => ({
            need: n.need,
            label: NEEDS[n.need].label,
            adaptation: NEEDS[n.need].adaptation,
            active: n.active,
            declaredBy: n.declaredBy,
          })),
        }
      : {}),
  };
}

async function append(
  db: SqlExecutor,
  learnerId: LearnerId,
  payload: LearningEventPayload,
  now: Date,
) {
  await createEventStore(db).append({
    id: asEventId(randomUUID()),
    learnerId,
    occurredAt: now,
    source: "web",
    payload,
  });
}

/** Profil et déclarations : l'élève pour lui-même, l'équipe de son organisation avec les permissions. */
export function profileRoutes(deps: Deps) {
  const organizations = createOrganizationStore(deps.db);

  /** Élève membre de l'organisation, et rôle de celui qui déclare (parent dans une famille, prof ailleurs). */
  const target = async (orgId: string, userId: string) => {
    const organizationId = asOrganizationId(orgId);
    const org = await organizations.getOrganization(organizationId);
    if (
      !org ||
      !(await organizations.isMember(organizationId, asUserId(userId)))
    )
      return null;
    return {
      organizationId,
      learnerId: asLearnerId(userId),
      source:
        org.kind === "family" ? ("guardian" as const) : ("teacher" as const),
    };
  };

  return new Hono<Env>()
    .use(requireSession(deps))
    .get("/learner/profile", async (c) => {
      return c.json(
        await explicableProfile(deps.db, asLearnerId(c.get("user").id), true),
        200,
      );
    })
    .post(
      "/learner/preferences",
      zValidator("json", preferenceBody),
      async (c) => {
        const body = c.req.valid("json");
        if (!isPreferenceKey(body.key))
          return fail(c, 422, "invalid_preference");
        if (body.key === "interest" && !body.label)
          return fail(c, 422, "label_required");
        await append(
          deps.db,
          asLearnerId(c.get("user").id),
          {
            type: "preference.declared",
            key: body.key,
            label: body.label,
            value: body.value,
            source: "learner",
          },
          deps.now(),
        );
        return c.json({ ok: true }, 201);
      },
    )
    .get(
      "/admin/organizations/:id/learners/:userId/profile",
      zValidator("param", z.object({ id: uuid, userId: uuid })),
      async (c) => {
        const params = c.req.valid("param");
        const t = await target(params.id, params.userId);
        if (!t) return fail(c, 404, "not_found");
        if (!allowed(c, "learners.read", t.organizationId))
          return fail(c, 403, "forbidden");
        const withNeeds = allowed(c, "learners.health.read", t.organizationId);
        return c.json(
          await explicableProfile(deps.db, t.learnerId, withNeeds),
          200,
        );
      },
    )
    .post(
      "/admin/organizations/:id/learners/:userId/preferences",
      zValidator("param", z.object({ id: uuid, userId: uuid })),
      zValidator("json", preferenceBody),
      async (c) => {
        const params = c.req.valid("param");
        const t = await target(params.id, params.userId);
        if (!t) return fail(c, 404, "not_found");
        if (!allowed(c, "learners.write", t.organizationId))
          return fail(c, 403, "forbidden");
        const body = c.req.valid("json");
        if (!isPreferenceKey(body.key))
          return fail(c, 422, "invalid_preference");
        if (body.key === "interest" && !body.label)
          return fail(c, 422, "label_required");
        await deps.db.transaction(async (tx) => {
          await append(
            tx,
            t.learnerId,
            {
              type: "preference.declared",
              key: body.key,
              label: body.label,
              value: body.value,
              source: t.source,
            },
            deps.now(),
          );
          await createAuditLog(tx).append({
            actorId: c.get("user").id,
            organizationId: t.organizationId,
            action: "learner.preference",
            targetType: "learner",
            targetId: t.learnerId,
            details: { key: body.key },
          });
        });
        return c.json({ ok: true }, 201);
      },
    )
    .post(
      "/admin/organizations/:id/learners/:userId/needs",
      zValidator("param", z.object({ id: uuid, userId: uuid })),
      zValidator("json", needBody),
      async (c) => {
        const params = c.req.valid("param");
        const t = await target(params.id, params.userId);
        if (!t) return fail(c, 404, "not_found");
        if (!allowed(c, "learners.health.write", t.organizationId))
          return fail(c, 403, "forbidden");
        const body = c.req.valid("json");
        if (!isNeedKey(body.need)) return fail(c, 422, "invalid_need");
        await deps.db.transaction(async (tx) => {
          await append(
            tx,
            t.learnerId,
            {
              type: "need.declared",
              need: body.need,
              active: body.active,
              source: t.source,
              consent: true,
            },
            deps.now(),
          );
          // L'audit trace l'action, pas la donnée de santé elle-même.
          await createAuditLog(tx).append({
            actorId: c.get("user").id,
            organizationId: t.organizationId,
            action: "learner.need",
            targetType: "learner",
            targetId: t.learnerId,
            details: {},
          });
        });
        return c.json({ ok: true }, 201);
      },
    );
}
