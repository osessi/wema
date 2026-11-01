import { zValidator } from "@hono/zod-validator";
import {
  createAuditLog,
  createClassStore,
  createCurriculumStore,
  createEventStore,
  createExerciseStore,
  createOrganizationStore,
  type SchoolClass,
} from "@wema/db";
import {
  asExerciseIntentId,
  asLearnerId,
  asOrganizationId,
  asProgramId,
  asUserId,
  type NotionStatus,
} from "@wema/domain";
import { generateVariant, planVariant, seedFrom } from "@wema/exercises";
import { type Context, Hono } from "hono";
import { z } from "zod";
import type { Deps, Env } from "../context";
import { learnerNextActions } from "../followup";
import { allowed, fail, requireSession } from "../http";
import { learnerModel } from "./exercises";

const uuid = z.uuid();
const name = z.string().trim().min(1).max(120);

/** Classes, devoirs et suivi : prof, école, parent, élève. */
export function classRoutes(deps: Deps) {
  const classes = createClassStore(deps.db);
  const organizations = createOrganizationStore(deps.db);

  /** Classe que l'utilisateur peut piloter : il en est prof, ou il gère les classes de l'organisation. */
  const manageable = async (
    c: Context<Env>,
    classId: string,
  ): Promise<SchoolClass | null | "forbidden"> => {
    const k = await classes.getClass(classId);
    if (!k) return null;
    if (
      allowed(c, "classes.manage", k.organizationId) ||
      (await classes.isTeacherOf(k.id, c.get("user").id))
    )
      return k;
    return "forbidden";
  };

  const trace = (
    c: Context<Env>,
    organizationId: string,
    action: string,
    targetId: string,
    details: Record<string, unknown> = {},
  ) =>
    createAuditLog(deps.db).append({
      actorId: c.get("user").id,
      organizationId: asOrganizationId(organizationId),
      action,
      targetType: "class",
      targetId,
      details,
    });

  /** Carte d'une classe : statut de chaque élève sur chaque notion du programme. */
  const classMap = async (k: SchoolClass) => {
    const members = (await classes.listMembers(k.id)).filter(
      (m) => m.role === "learner",
    );
    const curriculum = createCurriculumStore(deps.db);
    const country = k.programId
      ? await curriculum.countryOfProgram(k.programId)
      : null;
    const rows = country ? await curriculum.loadCountry(country) : null;
    const unitIds = new Set(
      (rows?.units ?? [])
        .filter((u) => u.programId === k.programId)
        .map((u) => u.id),
    );
    const notions = (rows?.notions ?? []).filter(
      (n) => unitIds.has(n.unitId) && !n.archived,
    );
    const learners = [];
    const byNotion = new Map(
      notions.map((n) => [
        n.id,
        {
          notionId: n.id,
          name: n.name,
          counts: { not_seen: 0, needs_work: 0, in_progress: 0, mastered: 0 },
          misconceptions: new Map<string, number>(),
        },
      ]),
    );
    for (const m of members) {
      const learnerId = asLearnerId(m.userId);
      const { model, events } = await learnerModel(deps.db, learnerId);
      const statuses: Record<string, NotionStatus> = {};
      for (const n of notions) {
        const state = model.notions[n.id];
        const status: NotionStatus = state?.status ?? "not_seen";
        statuses[n.id] = status;
        const entry = byNotion.get(n.id);
        if (entry) {
          entry.counts[status]++;
          for (const mis of state?.misconceptions.filter((x) => x.active) ??
            []) {
            entry.misconceptions.set(
              mis.misconceptionId,
              (entry.misconceptions.get(mis.misconceptionId) ?? 0) + 1,
            );
          }
        }
      }
      learners.push({
        userId: m.userId,
        displayName: m.displayName,
        lastActivityAt: events.at(-1)?.occurredAt ?? null,
        statuses,
        activeMisconceptions: Object.values(model.notions).reduce(
          (sum, s) => sum + s.misconceptions.filter((x) => x.active).length,
          0,
        ),
      });
    }
    const descriptions = new Map<string, string>(
      notions.flatMap((n) =>
        n.misconceptions.map((m): [string, string] => [m.id, m.description]),
      ),
    );
    return {
      class: k,
      learners,
      notions: [...byNotion.values()].map((n) => ({
        notionId: n.notionId,
        name: n.name,
        counts: n.counts,
        // Idées fausses les plus fréquentes dans la classe : à travailler collectivement.
        topMisconceptions: [...n.misconceptions.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([id, count]) => ({
            misconceptionId: id,
            description: descriptions.get(id) ?? null,
            learners: count,
          })),
      })),
    };
  };

  return new Hono<Env>()
    .use(requireSession(deps))
    .post(
      "/admin/organizations/:id/classes",
      zValidator("param", z.object({ id: uuid })),
      zValidator(
        "json",
        z.object({ name, programId: uuid.nullable().default(null) }),
      ),
      async (c) => {
        const organizationId = asOrganizationId(c.req.valid("param").id);
        if (!allowed(c, "classes.manage", organizationId))
          return fail(c, 403, "forbidden");
        const body = c.req.valid("json");
        const created = await classes.createClass({
          organizationId,
          name: body.name,
          programId: body.programId ? asProgramId(body.programId) : null,
        });
        if (!created) return fail(c, 409, "duplicate_class_name");
        await trace(c, organizationId, "class.create", created.id, {
          name: body.name,
        });
        return c.json({ ok: true, id: created.id }, 201);
      },
    )
    .get(
      "/admin/organizations/:id/classes",
      zValidator("param", z.object({ id: uuid })),
      async (c) => {
        const organizationId = asOrganizationId(c.req.valid("param").id);
        if (allowed(c, "classes.manage", organizationId))
          return c.json(
            { classes: await classes.listClasses(organizationId) },
            200,
          );
        // Un prof ne voit que les classes dont il est prof.
        const mine = (
          await classes.classesOf(c.get("user").id, "teacher")
        ).filter((k) => k.organizationId === organizationId);
        return c.json({ classes: mine }, 200);
      },
    )
    .get(
      "/admin/classes/:id",
      zValidator("param", z.object({ id: uuid })),
      async (c) => {
        const k = await manageable(c, c.req.valid("param").id);
        if (!k) return fail(c, 404, "not_found");
        if (k === "forbidden") return fail(c, 403, "forbidden");
        return c.json(
          { class: k, members: await classes.listMembers(k.id) },
          200,
        );
      },
    )
    .post(
      "/admin/classes/:id/members",
      zValidator("param", z.object({ id: uuid })),
      zValidator(
        "json",
        z.object({ userId: uuid, role: z.enum(["learner", "teacher"]) }),
      ),
      async (c) => {
        const k = await classes.getClass(c.req.valid("param").id);
        if (!k) return fail(c, 404, "not_found");
        if (!allowed(c, "classes.manage", k.organizationId))
          return fail(c, 403, "forbidden");
        const body = c.req.valid("json");
        // On n'inscrit qu'un membre de l'organisation de la classe.
        if (
          !(await organizations.isMember(
            k.organizationId,
            asUserId(body.userId),
          ))
        )
          return fail(c, 404, "not_found");
        await classes.addMember({
          classId: k.id,
          userId: asUserId(body.userId),
          role: body.role,
        });
        await trace(c, k.organizationId, "class.member_add", k.id, {
          userId: body.userId,
          role: body.role,
        });
        return c.json({ ok: true });
      },
    )
    .delete(
      "/admin/classes/:id/members/:userId",
      zValidator("param", z.object({ id: uuid, userId: uuid })),
      async (c) => {
        const params = c.req.valid("param");
        const k = await classes.getClass(params.id);
        if (!k) return fail(c, 404, "not_found");
        if (!allowed(c, "classes.manage", k.organizationId))
          return fail(c, 403, "forbidden");
        if (!(await classes.removeMember(k.id, asUserId(params.userId))))
          return fail(c, 404, "not_found");
        await trace(c, k.organizationId, "class.member_remove", k.id, {
          userId: params.userId,
        });
        return c.json({ ok: true });
      },
    )
    .post(
      "/admin/classes/:id/assignments",
      zValidator("param", z.object({ id: uuid })),
      zValidator(
        "json",
        z.object({
          intentId: uuid,
          title: name,
          dueAt: z.iso.datetime({ offset: true }),
        }),
      ),
      async (c) => {
        const k = await manageable(c, c.req.valid("param").id);
        if (!k) return fail(c, 404, "not_found");
        if (k === "forbidden") return fail(c, 403, "forbidden");
        const body = c.req.valid("json");
        const exercises = createExerciseStore(deps.db);
        const intent = await exercises.getIntent(
          asExerciseIntentId(body.intentId),
        );
        const platform = await organizations.getPlatformOrganization();
        // Exercice validé, de l'organisation ou de la bibliothèque Wema.
        if (
          !intent ||
          (intent.organizationId !== k.organizationId &&
            intent.organizationId !== platform?.id)
        ) {
          return fail(c, 404, "not_found");
        }
        if (intent.status !== "validated")
          return fail(c, 422, "exercise_not_validated");
        const dueAt = new Date(body.dueAt);
        if (dueAt.getTime() <= deps.now().getTime())
          return fail(c, 422, "due_date_in_past");
        const assignment = await classes.createAssignment({
          classId: k.id,
          intentId: intent.id,
          title: body.title,
          dueAt,
          createdBy: c.get("user").id,
        });
        // Une variante par élève, adaptée à son profil et vérifiée par services/math.
        const created: string[] = [];
        const failed: { learnerId: string; error: string }[] = [];
        for (const m of (await classes.listMembers(k.id)).filter(
          (x) => x.role === "learner",
        )) {
          const learnerId = asLearnerId(m.userId);
          const { model, settings } = await learnerModel(deps.db, learnerId);
          const variant = await generateVariant({
            intent,
            plan: planVariant(intent, model.notions[intent.notionId], settings),
            seed: seedFrom(`${learnerId}:${assignment.id}`),
            verifier: deps.math,
          });
          if (!variant.ok) {
            failed.push({
              learnerId: m.userId,
              error:
                variant.error.kind === "unavailable"
                  ? "math_unavailable"
                  : variant.error.kind,
            });
            continue;
          }
          const v = variant.value;
          await exercises.createVariant({
            intentId: intent.id,
            assignmentId: assignment.id,
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
            verifiedAt: new Date(),
          });
          created.push(m.userId);
        }
        await trace(c, k.organizationId, "assignment.create", assignment.id, {
          classId: k.id,
          intentId: intent.id,
        });
        return c.json(
          { ok: true, id: assignment.id, created: created.length, failed },
          201,
        );
      },
    )
    .get(
      "/admin/classes/:id/assignments",
      zValidator("param", z.object({ id: uuid })),
      async (c) => {
        const k = await manageable(c, c.req.valid("param").id);
        if (!k) return fail(c, 404, "not_found");
        if (k === "forbidden") return fail(c, 403, "forbidden");
        return c.json(
          { assignments: await classes.listAssignments(k.id) },
          200,
        );
      },
    )
    .get(
      "/admin/classes/:id/map",
      zValidator("param", z.object({ id: uuid })),
      async (c) => {
        const k = await manageable(c, c.req.valid("param").id);
        if (!k) return fail(c, 404, "not_found");
        if (k === "forbidden") return fail(c, 403, "forbidden");
        return c.json(await classMap(k), 200);
      },
    )
    .get(
      "/admin/organizations/:id/overview",
      zValidator("param", z.object({ id: uuid })),
      async (c) => {
        const organizationId = asOrganizationId(c.req.valid("param").id);
        if (
          !allowed(c, "classes.manage", organizationId) &&
          !allowed(c, "members.manage", organizationId)
        ) {
          return fail(c, 403, "forbidden");
        }
        const weekAgo = deps.now().getTime() - 7 * 24 * 60 * 60 * 1000;
        const lastActivity = new Map(
          (await createEventStore(deps.db).lastActivityByLearner()).map((l) => [
            l.learnerId,
            l.lastActivityAt.getTime(),
          ]),
        );
        const summary = [];
        for (const k of await classes.listClasses(organizationId)) {
          const map = await classMap(k);
          const cells = map.notions.reduce(
            (sum, n) =>
              sum +
              n.counts.mastered +
              n.counts.in_progress +
              n.counts.needs_work +
              n.counts.not_seen,
            0,
          );
          const mastered = map.notions.reduce(
            (sum, n) => sum + n.counts.mastered,
            0,
          );
          summary.push({
            classId: k.id,
            name: k.name,
            learners: map.learners.length,
            activeThisWeek: map.learners.filter(
              (l) => (lastActivity.get(asLearnerId(l.userId)) ?? 0) >= weekAgo,
            ).length,
            masteredShare:
              cells > 0 ? Math.round((mastered / cells) * 100) / 100 : null,
          });
        }
        return c.json({ classes: summary }, 200);
      },
    )
    .post(
      "/admin/organizations/:id/guardianships",
      zValidator("param", z.object({ id: uuid })),
      zValidator("json", z.object({ guardianId: uuid, learnerId: uuid })),
      async (c) => {
        const organizationId = asOrganizationId(c.req.valid("param").id);
        if (!allowed(c, "members.manage", organizationId))
          return fail(c, 403, "forbidden");
        const org = await organizations.getOrganization(organizationId);
        if (org?.kind !== "family") return fail(c, 422, "family_only");
        const body = c.req.valid("json");
        const both =
          (await organizations.isMember(
            organizationId,
            asUserId(body.guardianId),
          )) &&
          (await organizations.isMember(
            organizationId,
            asUserId(body.learnerId),
          ));
        if (!both) return fail(c, 404, "not_found");
        await classes.link({
          organizationId,
          guardianId: asUserId(body.guardianId),
          learnerId: asUserId(body.learnerId),
        });
        await trace(c, organizationId, "guardianship.create", body.learnerId, {
          guardianId: body.guardianId,
        });
        return c.json({ ok: true }, 201);
      },
    )
    .get("/parent/children", async (c) => {
      const children = await classes.childrenOf(c.get("user").id);
      const now = deps.now();
      const result = [];
      for (const child of children) {
        const { model } = await learnerModel(deps.db, child.learnerId);
        const states = Object.values(model.notions);
        const assignments = await classes.assignmentsForLearner(
          child.learnerId,
        );
        const { actions } = await learnerNextActions(
          deps.db,
          child.learnerId,
          now,
        );
        result.push({
          learnerId: child.learnerId,
          displayName: child.displayName,
          organizationId: child.organizationId,
          notions: {
            mastered: states.filter((s) => s.status === "mastered").length,
            inProgress: states.filter((s) => s.status === "in_progress").length,
            needsWork: states.filter((s) => s.status === "needs_work").length,
          },
          assignments: {
            pending: assignments.filter(
              (a) => !a.done && a.dueAt.getTime() >= now.getTime(),
            ).length,
            late: assignments.filter(
              (a) => !a.done && a.dueAt.getTime() < now.getTime(),
            ).length,
            done: assignments.filter((a) => a.done).length,
          },
          nextActions: actions
            .slice(0, 3)
            .map((a) => ({ kind: a.kind, reason: a.reason })),
        });
      }
      return c.json({ children: result }, 200);
    })
    .get("/learner/assignments", async (c) => {
      const now = deps.now();
      const list = await classes.assignmentsForLearner(
        asLearnerId(c.get("user").id),
      );
      return c.json(
        {
          assignments: list.map((a) => ({
            id: a.id,
            title: a.title,
            dueAt: a.dueAt,
            variantId: a.variantId,
            status: a.done
              ? a.correct
                ? "done"
                : "attempted"
              : a.dueAt.getTime() < now.getTime()
                ? "late"
                : "todo",
          })),
        },
        200,
      );
    });
}
