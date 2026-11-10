import { zValidator } from "@hono/zod-validator";
import {
  createAccountStore,
  createAuditLog,
  createClassStore,
  createOnboardingStore,
  createOrganizationStore,
  ONBOARDING_STEPS,
} from "@wema/db";
import { asOrganizationId, type OrganizationId } from "@wema/domain";
import { type Context, Hono } from "hono";
import { z } from "zod";
import type { Deps, Env } from "../context";
import { fail, requireSession } from "../http";
import { learnerRole } from "./roster";

const uuid = z.uuid();

/**
 * Prof particulier autonome : il s'inscrit seul et reçoit son organisation
 * (type « tutoring »), où il est à la fois responsable (il gère ses élèves et
 * leurs comptes) et prof (il donne les devoirs). Ses élèves n'ont rien à payer
 * quand l'équipe Wema met son organisation sous contrat (back-office).
 */
export function tutoringRoutes(deps: Deps) {
  const organizations = createOrganizationStore(deps.db);
  const onboarding = createOnboardingStore(deps.db);

  /** Réseaux de profs dont l'utilisateur gère les membres. */
  const managedTutoring = (c: Context<Env>): OrganizationId[] => [
    ...new Set(
      c
        .get("memberships")
        .filter(
          (m) =>
            m.organizationKind === "tutoring" &&
            m.permissions.includes("members.manage"),
        )
        .map((m) => m.organizationId),
    ),
  ];

  return (
    new Hono<Env>()
      .use(requireSession(deps))
      .post(
        "/",
        zValidator(
          "json",
          z.object({ name: z.string().trim().min(1).max(200).optional() }),
        ),
        async (c) => {
          const user = c.get("user");
          // Un compte créé pour quelqu'un (élève, parent) ne fonde pas d'organisation.
          if (
            (await createAccountStore(deps.db).ownerOrganization(user.id)) !==
            null
          )
            return fail(c, 403, "forbidden");
          const name =
            c.req.valid("json").name ?? `Cours de ${user.displayName}`;
          const created = await deps.db.transaction(async (tx) => {
            // Une organisation par prof : deux envois simultanés n'en créent pas deux.
            await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
              `wema_tutoring:${user.id}`,
            ]);
            const { rows } = await tx.query(
              `SELECT 1 FROM memberships m JOIN organizations o ON o.id = m.organization_id
               JOIN roles r ON r.id = m.role_id
               WHERE m.user_id = $1 AND o.kind = 'tutoring' AND 'members.manage' = ANY(r.permissions)`,
              [user.id],
            );
            if (rows.length > 0) return null;
            const store = createOrganizationStore(tx);
            const org = await store.createOrganization({
              name,
              kind: "tutoring",
              defaultRoles: true,
            });
            const roles = await store.listRoles(org.id);
            const manager = roles.find((r) =>
              r.permissions.includes("members.manage"),
            );
            const teacher = roles.find(
              (r) =>
                r.permissions.includes("exercises.write") &&
                !r.permissions.includes("members.manage"),
            );
            if (!manager || !teacher)
              throw new Error("rôles du prof manquants");
            for (const role of [teacher, manager]) {
              const added = await store.addMembership({
                userId: user.id,
                roleId: role.id,
              });
              if (!added.ok) throw new Error(added.error.kind);
            }
            await createAuditLog(tx).append({
              actorId: user.id,
              organizationId: org.id,
              action: "organization.create",
              targetType: "organization",
              targetId: org.id,
              details: { kind: "tutoring", selfService: true },
            });
            return org;
          });
          if (!created) return fail(c, 409, "tutoring_exists");
          return c.json({ ok: true, id: created.id }, 201);
        },
      )
      // Où en est le démarrage : groupes, élèves (et leurs parents), devoirs.
      .get("/", async (c) => {
        const id = managedTutoring(c)[0];
        if (!id) return c.json({ organization: null }, 200);
        const org = await organizations.getOrganization(id);
        if (!org) return c.json({ organization: null }, 200);
        const classes = createClassStore(deps.db);
        const list = await classes.listClasses(id);
        const role = learnerRole(org, await organizations.listRoles(id));
        const learners = (await organizations.listMembers(id)).filter(
          (m) => !m.disabled && m.roles.some((r) => r.id === role?.id),
        );
        const { rows: guardians } = await deps.db.query<{
          learner_id: string;
          n: number;
        }>(
          `SELECT learner_id, count(*)::int AS n FROM guardianships
           WHERE learner_id = ANY($1::uuid[]) GROUP BY learner_id`,
          [learners.map((l) => l.userId)],
        );
        const { rows: assignments } = await deps.db.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM assignments a JOIN classes k ON k.id = a.class_id
           WHERE k.organization_id = $1`,
          [id],
        );
        const counts = new Map(guardians.map((g) => [g.learner_id, g.n]));
        return c.json(
          {
            organization: { id: org.id, name: org.name },
            steps: await onboarding.steps(id, c.get("user").id),
            classes: list.map((k) => ({
              id: k.id,
              name: k.name,
              programId: k.programId,
            })),
            learners: learners.map((l) => ({
              userId: l.userId,
              displayName: l.displayName,
              username:
                l.identities.find((i) => i.kind === "username")?.identifier ??
                null,
              guardians: counts.get(l.userId) ?? 0,
            })),
            assignments: assignments[0]?.n ?? 0,
          },
          200,
        );
      })
      .put(
        "/:id/onboarding/:step",
        zValidator(
          "param",
          z.object({ id: uuid, step: z.enum(ONBOARDING_STEPS) }),
        ),
        zValidator("json", z.object({ status: z.enum(["done", "skipped"]) })),
        async (c) => {
          const params = c.req.valid("param");
          const organizationId = asOrganizationId(params.id);
          if (!managedTutoring(c).includes(organizationId))
            return fail(c, 403, "forbidden");
          await onboarding.setStep({
            organizationId,
            userId: c.get("user").id,
            step: params.step,
            status: c.req.valid("json").status,
          });
          return c.json({ ok: true });
        },
      )
  );
}
