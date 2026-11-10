import { randomUUID } from "node:crypto";
import { zValidator } from "@hono/zod-validator";
import {
  createAuditLog,
  createEventStore,
  createOrganizationStore,
} from "@wema/db";
import {
  asEventId,
  asLearnerId,
  asOrganizationId,
  asUserId,
  cleanTeacherNote,
  teacherNoteProblem,
} from "@wema/domain";
import { projectHypotheses } from "@wema/learner-model";
import { Hono } from "hono";
import { z } from "zod";
import type { Deps, Env } from "../context";
import { allowed, fail, requireSession } from "../http";

const params = z.object({ id: z.uuid(), userId: z.uuid() });

/**
 * Notes libres d'un prof sur un élève (écrites ou dictées). Chaque note est
 * un événement `teacher.noted` du journal (observation `declared_teacher`) ;
 * seuls les profs de la même organisation la relisent, et le prof IA la reçoit
 * comme une donnée. Une note qui parle de santé est refusée : ces besoins
 * passent par la déclaration avec le consentement du parent.
 */
export function teacherNoteRoutes(deps: Deps) {
  const organizations = createOrganizationStore(deps.db);

  /** Élève membre d'une organisation qui n'est pas une famille (côté prof). */
  const target = async (orgId: string, userId: string) => {
    const organizationId = asOrganizationId(orgId);
    const org = await organizations.getOrganization(organizationId);
    if (
      !org ||
      org.kind === "family" ||
      !(await organizations.isMember(organizationId, asUserId(userId)))
    )
      return null;
    return { organizationId, learnerId: asLearnerId(userId) };
  };

  return new Hono<Env>()
    .use(requireSession(deps))
    .get(
      "/admin/organizations/:id/learners/:userId/notes",
      zValidator("param", params),
      async (c) => {
        const p = c.req.valid("param");
        const t = await target(p.id, p.userId);
        if (!t) return fail(c, 404, "not_found");
        if (!allowed(c, "learners.read", t.organizationId))
          return fail(c, 403, "forbidden");
        const events = await createEventStore(deps.db).listByLearner(
          t.learnerId,
        );
        const notes = projectHypotheses(events)
          .notes.filter((n) => n.organizationId === t.organizationId)
          .reverse()
          .map((n) => ({
            id: n.evidence,
            text: n.text,
            at: n.at.toISOString(),
            source: n.source,
          }));
        return c.json({ notes }, 200);
      },
    )
    .post(
      "/admin/organizations/:id/learners/:userId/notes",
      zValidator("param", params),
      zValidator("json", z.object({ text: z.string().max(2000) })),
      async (c) => {
        const p = c.req.valid("param");
        const t = await target(p.id, p.userId);
        if (!t) return fail(c, 404, "not_found");
        if (!allowed(c, "learners.write", t.organizationId))
          return fail(c, 403, "forbidden");
        const text = cleanTeacherNote(c.req.valid("json").text);
        const problem = teacherNoteProblem(text);
        if (problem === "health") return fail(c, 422, "health_note");
        if (problem === "personal_data")
          return fail(c, 422, "personal_data_note");
        if (problem) return fail(c, 422, "invalid_note");
        const id = asEventId(randomUUID());
        await deps.db.transaction(async (tx) => {
          const appended = await createEventStore(tx).append({
            id,
            learnerId: t.learnerId,
            occurredAt: deps.now(),
            source: "teacher",
            payload: {
              type: "teacher.noted",
              organizationId: t.organizationId,
              text,
            },
          });
          if (!appended.ok)
            throw new Error("identifiant d'événement en conflit");
          // L'audit trace l'action, pas le texte de la note.
          await createAuditLog(tx).append({
            actorId: c.get("user").id,
            organizationId: t.organizationId,
            action: "learner.note",
            targetType: "learner",
            targetId: t.learnerId,
            details: {},
          });
        });
        return c.json({ ok: true, id }, 201);
      },
    );
}
