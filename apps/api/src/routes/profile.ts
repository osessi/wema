import { randomUUID } from "node:crypto";
import { zValidator } from "@hono/zod-validator";
import {
  createAccountStore,
  createAuditLog,
  createEventStore,
  createHealthStore,
  createOrganizationStore,
  type HealthDeclaration,
  type SqlExecutor,
} from "@wema/db";
import {
  asEventId,
  asLearnerId,
  asOrganizationId,
  asUserId,
  isNeedKey,
  isPreferenceKey,
  isSafeInterestLabel,
  type LearnerId,
  type LearningEvent,
  type LearningEventPayload,
  NEEDS,
  type OrganizationId,
} from "@wema/domain";
import { projectHypotheses } from "@wema/learner-model";
import { type Context, Hono } from "hono";
import { z } from "zod";
import type { Deps, Env } from "../context";
import { allowed, fail, requireSession } from "../http";
import { notionInfo } from "../tutor-context";
import { learnerModel } from "./exercises";

const uuid = z.uuid();
const preferenceBody = z.object({
  key: z.string().refine(isPreferenceKey, { message: "préférence inconnue" }),
  label: z.string().trim().min(1).max(40).nullable().default(null),
  value: z.boolean().default(true),
});
const needBody = z.object({
  need: z.string().refine(isNeedKey, { message: "besoin inconnu" }),
  active: z.boolean(),
  /** Pour un parent, la déclaration vaut consentement : il doit le cocher explicitement. */
  consent: z.boolean().default(false),
});

/** Profil explicable : chaque affirmation vient avec ses preuves (règle n°4). Sans données de santé. */
export async function explicableProfile(db: SqlExecutor, learnerId: LearnerId) {
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
          // Idée fausse repérée par l'IA : la source et la confiance sont montrées.
          misconceptionSource: e.payload.misconceptionSource,
          misconceptionConfidence: e.payload.misconceptionConfidence,
        }
      : null;

  const notions = [];
  const countries: Parameters<typeof notionInfo>[2] = new Map();
  for (const state of Object.values(model.notions)) {
    const info = await notionInfo(db, state.notionId, countries);
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
          sessionId: a.sessionId,
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
  };
}

const describeNeed = (d: HealthDeclaration) => ({
  id: d.id,
  need: d.need,
  label: NEEDS[d.need].label,
  adaptation: NEEDS[d.need].adaptation,
  active: d.active,
  declaredRole: d.declaredRole,
  consent: d.consent,
});

async function append(
  db: SqlExecutor,
  learnerId: LearnerId,
  payload: LearningEventPayload,
  now: Date,
) {
  const appended = await createEventStore(db).append({
    id: asEventId(randomUUID()),
    learnerId,
    occurredAt: now,
    source: "web",
    payload,
  });
  if (!appended.ok) throw new Error("identifiant d'événement en conflit");
}

/** Profil et déclarations : l'élève pour lui-même, l'équipe de son organisation avec les permissions. */
export function profileRoutes(deps: Deps) {
  const organizations = createOrganizationStore(deps.db);
  const health = createHealthStore(deps.db, deps.healthKey);

  /** Élève membre de l'organisation, et rôle de celui qui agit (parent dans une famille, prof ailleurs). */
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
      role:
        org.kind === "family" ? ("guardian" as const) : ("teacher" as const),
    };
  };

  /** Lecteur qui n'a le droit « santé » que par l'équipe Wema (sa lecture est tracée). */
  const viaPlatformOnly = (c: Context<Env>, organizationId: OrganizationId) => {
    const direct = c
      .get("memberships")
      .some(
        (m) =>
          m.organizationId === organizationId &&
          m.permissions.includes("learners.health.read"),
      );
    return !direct;
  };

  const traceHealth = (
    c: Context<Env>,
    organizationId: OrganizationId,
    learnerId: LearnerId,
    action: string,
  ) =>
    createAuditLog(deps.db).append({
      actorId: c.get("user").id,
      organizationId,
      action,
      targetType: "learner",
      targetId: learnerId,
      details: {},
    });

  return new Hono<Env>()
    .use(requireSession(deps))
    .get("/learner/profile", async (c) => {
      const learnerId = asLearnerId(c.get("user").id);
      const needs = (await health.list(learnerId))
        .filter((d) => d.consent === "given")
        .map(describeNeed);
      return c.json(
        { ...(await explicableProfile(deps.db, learnerId)), needs },
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
        if (
          body.key === "interest" &&
          !(body.label && isSafeInterestLabel(body.label))
        )
          return fail(c, 422, "invalid_label");
        await append(
          deps.db,
          asLearnerId(c.get("user").id),
          {
            type: "preference.declared",
            key: body.key,
            label: body.key === "interest" ? body.label : null,
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
        const profile = await explicableProfile(deps.db, t.learnerId);
        if (!allowed(c, "learners.health.read", t.organizationId))
          return c.json(profile, 200);
        // Besoins visibles : ceux déclarés par cette organisation, et ceux que le parent lui a partagés.
        const platform = viaPlatformOnly(c, t.organizationId);
        const shared = await health.sharedWith(t.learnerId);
        // Le parent voit aussi les déclarations en attente de son consentement :
        // c'est lui qui les confirme ou les refuse (fiche 0006).
        const needs = (await health.list(t.learnerId)).filter(
          (d) =>
            platform ||
            d.declaredOrg === t.organizationId ||
            (t.role === "guardian" &&
              d.consent === "pending" &&
              allowed(c, "learners.health.write", t.organizationId)) ||
            (d.consent === "given" && shared.includes(t.organizationId)),
        );
        // L'équipe Wema peut lire pour l'assistance : chaque lecture est tracée (fiche 0006).
        if (platform)
          await traceHealth(c, t.organizationId, t.learnerId, "health.read");
        return c.json({ ...profile, needs: needs.map(describeNeed) }, 200);
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
        if (
          body.key === "interest" &&
          !(body.label && isSafeInterestLabel(body.label))
        )
          return fail(c, 422, "invalid_label");
        await deps.db.transaction(async (tx) => {
          await append(
            tx,
            t.learnerId,
            {
              type: "preference.declared",
              key: body.key,
              label: body.key === "interest" ? body.label : null,
              value: body.value,
              source: t.role,
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
        // Un parent consent en déclarant (case cochée) ; un prof déclare, le parent confirmera.
        if (t.role === "guardian" && !body.consent)
          return fail(c, 422, "consent_required");
        const declared = await health.declare({
          learnerId: t.learnerId,
          need: body.need,
          active: body.active,
          declaredBy: c.get("user").id,
          declaredOrg: t.organizationId,
          role: t.role,
        });
        // L'audit trace l'action, jamais la donnée de santé elle-même.
        await traceHealth(c, t.organizationId, t.learnerId, "health.declare");
        return c.json(
          {
            ok: true,
            id: declared?.id ?? null,
            consent: declared?.consent ?? null,
          },
          201,
        );
      },
    )
    .post(
      "/admin/organizations/:id/learners/:userId/needs/:needId/consent",
      zValidator("param", z.object({ id: uuid, userId: uuid, needId: uuid })),
      async (c) => {
        const params = c.req.valid("param");
        const t = await target(params.id, params.userId);
        if (!t) return fail(c, 404, "not_found");
        // Seul un parent (organisation famille) donne le consentement.
        if (
          t.role !== "guardian" ||
          !allowed(c, "learners.health.write", t.organizationId)
        )
          return fail(c, 403, "forbidden");
        if (
          !(await health.giveConsent({
            learnerId: t.learnerId,
            id: params.needId,
            guardian: c.get("user").id,
          }))
        ) {
          return fail(c, 404, "not_found");
        }
        await traceHealth(c, t.organizationId, t.learnerId, "health.consent");
        return c.json({ ok: true });
      },
    )
    .delete(
      "/admin/organizations/:id/learners/:userId/needs/:needId",
      zValidator("param", z.object({ id: uuid, userId: uuid, needId: uuid })),
      async (c) => {
        const params = c.req.valid("param");
        const t = await target(params.id, params.userId);
        if (!t) return fail(c, 404, "not_found");
        // Retrait du consentement par le parent : la déclaration est effacée.
        if (
          t.role !== "guardian" ||
          !allowed(c, "learners.health.write", t.organizationId)
        )
          return fail(c, 403, "forbidden");
        if (
          !(await health.remove({ learnerId: t.learnerId, id: params.needId }))
        )
          return fail(c, 404, "not_found");
        await traceHealth(c, t.organizationId, t.learnerId, "health.remove");
        return c.json({ ok: true });
      },
    )
    .get(
      "/admin/organizations/:id/learners/:userId/health-shares",
      zValidator("param", z.object({ id: uuid, userId: uuid })),
      async (c) => {
        const params = c.req.valid("param");
        const t = await target(params.id, params.userId);
        if (!t) return fail(c, 404, "not_found");
        // Le parent choisit avec qui partager : il voit les autres organisations de l'enfant.
        if (
          t.role !== "guardian" ||
          !allowed(c, "learners.health.write", t.organizationId)
        )
          return fail(c, 403, "forbidden");
        const shared = new Set(await health.sharedWith(t.learnerId));
        const ids = [
          ...new Set(
            (
              await createAccountStore(deps.db).listMemberships(
                asUserId(t.learnerId),
              )
            )
              .filter(
                (m) =>
                  m.organizationId !== t.organizationId &&
                  m.organizationKind !== "platform",
              )
              .map((m) => m.organizationId),
          ),
        ];
        const list = [];
        for (const id of ids) {
          const org = await organizations.getOrganization(id);
          if (org)
            list.push({
              id: org.id,
              name: org.name,
              kind: org.kind,
              shared: shared.has(org.id),
            });
        }
        return c.json({ organizations: list }, 200);
      },
    )
    .put(
      "/admin/organizations/:id/learners/:userId/health-shares/:organizationId",
      zValidator(
        "param",
        z.object({ id: uuid, userId: uuid, organizationId: uuid }),
      ),
      async (c) => {
        const params = c.req.valid("param");
        const t = await target(params.id, params.userId);
        if (!t) return fail(c, 404, "not_found");
        if (
          t.role !== "guardian" ||
          !allowed(c, "learners.health.write", t.organizationId)
        )
          return fail(c, 403, "forbidden");
        // On ne partage qu'avec une organisation dont l'élève est membre.
        const with_ = asOrganizationId(params.organizationId);
        if (!(await organizations.isMember(with_, asUserId(t.learnerId))))
          return fail(c, 404, "not_found");
        await health.share({
          learnerId: t.learnerId,
          organizationId: with_,
          grantedBy: c.get("user").id,
        });
        await traceHealth(c, t.organizationId, t.learnerId, "health.share");
        return c.json({ ok: true });
      },
    )
    .delete(
      "/admin/organizations/:id/learners/:userId/health-shares/:organizationId",
      zValidator(
        "param",
        z.object({ id: uuid, userId: uuid, organizationId: uuid }),
      ),
      async (c) => {
        const params = c.req.valid("param");
        const t = await target(params.id, params.userId);
        if (!t) return fail(c, 404, "not_found");
        if (
          t.role !== "guardian" ||
          !allowed(c, "learners.health.write", t.organizationId)
        )
          return fail(c, 403, "forbidden");
        await health.unshare({
          learnerId: t.learnerId,
          organizationId: asOrganizationId(params.organizationId),
        });
        await traceHealth(c, t.organizationId, t.learnerId, "health.unshare");
        return c.json({ ok: true });
      },
    );
}
