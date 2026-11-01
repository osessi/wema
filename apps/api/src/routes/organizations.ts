import { zValidator } from "@hono/zod-validator";
import {
  checkPasswordRules,
  generateLoginCode,
  hashPassword,
  normalizeEmail,
  normalizePhone,
  normalizeUsername,
} from "@wema/access";
import {
  createAccountStore,
  createAuditLog,
  createOrganizationStore,
} from "@wema/db";
import {
  asOrganizationId,
  asRoleId,
  asUserId,
  isPermission,
  type OrganizationId,
  type Permission,
  type UserId,
} from "@wema/domain";
import { type Context, Hono } from "hono";
import { z } from "zod";
import type { Deps, Env } from "../context";
import { allowed, fail, requireSession } from "../http";

const uuid = z.uuid();
const name = z.string().trim().min(1).max(200);
const permissions = z
  .array(z.string())
  .max(100)
  .transform((list) => list.filter(isPermission))
  .pipe(z.array(z.custom<Permission>()));

/** Moyen de connexion d'un compte créé par un adulte (prof, école, parent). */
const loginSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("email"),
    email: z.string(),
    password: z.string().optional(),
  }),
  z.object({ kind: z.literal("phone"), phone: z.string() }),
  z.object({ kind: z.literal("username"), username: z.string() }),
]);

export function organizationRoutes(deps: Deps) {
  const organizations = createOrganizationStore(deps.db);
  const audit = createAuditLog(deps.db);

  const trace = (
    c: Context<Env>,
    organizationId: OrganizationId,
    action: string,
    targetId: string,
    details: Record<string, unknown> = {},
  ) =>
    audit.append({
      actorId: c.get("user").id,
      organizationId,
      action,
      targetType: action.split(".")[0] ?? action,
      targetId,
      details,
    });

  return new Hono<Env>()
    .use(requireSession(deps))
    .get("/organizations", async (c) => {
      const all = await organizations.listOrganizations();
      if (allowed(c, "organizations.manage"))
        return c.json({ organizations: all }, 200);
      const mine = new Set(c.get("memberships").map((m) => m.organizationId));
      return c.json({ organizations: all.filter((o) => mine.has(o.id)) }, 200);
    })
    .post(
      "/organizations",
      zValidator(
        "json",
        z.object({ name, kind: z.enum(["school", "tutoring", "family"]) }),
      ),
      async (c) => {
        if (!allowed(c, "organizations.manage"))
          return fail(c, 403, "forbidden");
        const org = await organizations.createOrganization(c.req.valid("json"));
        await trace(c, org.id, "organization.create", org.id, {
          name: org.name,
          kind: org.kind,
        });
        return c.json({ ok: true, id: org.id }, 201);
      },
    )
    .get(
      "/organizations/:id/roles",
      zValidator("param", z.object({ id: uuid })),
      async (c) => {
        const id = asOrganizationId(c.req.valid("param").id);
        if (
          !allowed(c, "roles.manage", id) &&
          !allowed(c, "members.manage", id)
        )
          return fail(c, 403, "forbidden");
        return c.json({ roles: await organizations.listRoles(id) }, 200);
      },
    )
    .post(
      "/organizations/:id/roles",
      zValidator("param", z.object({ id: uuid })),
      zValidator("json", z.object({ name, permissions })),
      async (c) => {
        const id = asOrganizationId(c.req.valid("param").id);
        if (!allowed(c, "roles.manage", id)) return fail(c, 403, "forbidden");
        const body = c.req.valid("json");
        const role = await organizations.createRole({
          organizationId: id,
          ...body,
        });
        if (!role.ok) return fail(c, 409, role.error.kind);
        await trace(c, id, "role.create", role.value.id, body);
        return c.json({ ok: true, id: role.value.id }, 201);
      },
    )
    .patch(
      "/roles/:id",
      zValidator("param", z.object({ id: uuid })),
      zValidator("json", z.object({ name, permissions })),
      async (c) => {
        const role = await organizations.getRole(
          asRoleId(c.req.valid("param").id),
        );
        if (!role) return fail(c, 404, "role_not_found");
        if (!allowed(c, "roles.manage", role.organizationId))
          return fail(c, 403, "forbidden");
        const body = c.req.valid("json");
        const updated = await organizations.updateRole(role.id, body);
        if (!updated.ok)
          return fail(
            c,
            updated.error.kind === "role_not_found" ? 404 : 409,
            updated.error.kind,
          );
        await trace(c, role.organizationId, "role.update", role.id, body);
        return c.json({ ok: true, id: role.id });
      },
    )
    .delete(
      "/roles/:id",
      zValidator("param", z.object({ id: uuid })),
      async (c) => {
        const role = await organizations.getRole(
          asRoleId(c.req.valid("param").id),
        );
        if (!role) return fail(c, 404, "role_not_found");
        if (!allowed(c, "roles.manage", role.organizationId))
          return fail(c, 403, "forbidden");
        const deleted = await organizations.deleteRole(role.id);
        if (!deleted.ok) return fail(c, 409, deleted.error.kind);
        await trace(c, role.organizationId, "role.delete", role.id, {
          name: role.name,
        });
        return c.json({ ok: true, id: role.id });
      },
    )
    .get(
      "/organizations/:id/members",
      zValidator("param", z.object({ id: uuid })),
      async (c) => {
        const id = asOrganizationId(c.req.valid("param").id);
        if (!allowed(c, "members.manage", id)) return fail(c, 403, "forbidden");
        return c.json({ members: await organizations.listMembers(id) }, 200);
      },
    )
    .post(
      "/organizations/:id/members",
      zValidator("param", z.object({ id: uuid })),
      zValidator(
        "json",
        z.object({ displayName: name, roleId: uuid, login: loginSchema }),
      ),
      async (c) => {
        const organizationId = asOrganizationId(c.req.valid("param").id);
        if (!allowed(c, "members.manage", organizationId))
          return fail(c, 403, "forbidden");
        const body = c.req.valid("json");
        const role = await organizations.getRole(asRoleId(body.roleId));
        if (!role || role.organizationId !== organizationId)
          return fail(c, 422, "role_not_found");
        // Donner le rôle Super admin, c'est donner toutes les permissions :
        // réservé à ceux qui gèrent déjà les rôles de la plateforme.
        if (role.system && !allowed(c, "roles.manage", organizationId))
          return fail(c, 403, "forbidden");

        const login = body.login;
        let identifier: { kind: "email" | "phone" | "username"; value: string };
        let secretHash: string | null = null;
        let loginCode: string | null = null;
        if (login.kind === "email") {
          const email = normalizeEmail(login.email);
          if (!email.ok) return fail(c, 422, email.error.kind);
          identifier = { kind: "email", value: email.value };
          if (login.password !== undefined) {
            const rules = checkPasswordRules(login.password);
            if (!rules.ok) return fail(c, 422, rules.error.kind);
            secretHash = await hashPassword(login.password);
          }
        } else if (login.kind === "phone") {
          const phone = normalizePhone(login.phone);
          if (!phone.ok) return fail(c, 422, phone.error.kind);
          identifier = { kind: "phone", value: phone.value };
        } else {
          const username = normalizeUsername(login.username);
          if (!username.ok) return fail(c, 422, username.error.kind);
          identifier = { kind: "username", value: username.value };
          loginCode = generateLoginCode();
          secretHash = await hashPassword(loginCode);
        }

        const actor = c.get("user").id;
        const result = await deps.db.transaction(async (tx) => {
          const accounts = createAccountStore(tx);
          const existing = await accounts.findIdentity(
            identifier.kind,
            identifier.value,
          );
          // Un identifiant élève désigne un seul compte : on n'en rattache pas un existant.
          if (existing && identifier.kind === "username")
            return { kind: "username_taken" as const };
          let userId: UserId;
          let created = false;
          if (existing) {
            userId = existing.userId;
          } else {
            userId = (
              await accounts.createUser({
                displayName: body.displayName,
                createdBy: actor,
              })
            ).id;
            created = true;
            await accounts.addIdentity({
              userId,
              kind: identifier.kind,
              identifier: identifier.value,
              secretHash,
              verified: false,
            });
          }
          const membership = await createOrganizationStore(tx).addMembership({
            userId,
            roleId: role.id,
          });
          if (!membership.ok)
            throw new Error(
              `rattachement impossible : ${membership.error.kind}`,
            );
          return { kind: "ok" as const, userId, created };
        });
        if (result.kind === "username_taken")
          return fail(c, 409, "username_taken");

        await trace(c, organizationId, "member.add", result.userId, {
          roleId: role.id,
          created: result.created,
          loginKind: identifier.kind,
        });
        // Le code de connexion d'un compte élève n'est montré qu'une fois.
        return c.json(
          {
            ok: true,
            userId: result.userId,
            created: result.created,
            loginCode,
          },
          201,
        );
      },
    )
    .post(
      "/organizations/:id/members/:userId/roles",
      zValidator("param", z.object({ id: uuid, userId: uuid })),
      zValidator("json", z.object({ roleId: uuid })),
      async (c) => {
        const organizationId = asOrganizationId(c.req.valid("param").id);
        const userId = asUserId(c.req.valid("param").userId);
        if (!allowed(c, "members.manage", organizationId))
          return fail(c, 403, "forbidden");
        const role = await organizations.getRole(
          asRoleId(c.req.valid("json").roleId),
        );
        if (!role || role.organizationId !== organizationId)
          return fail(c, 422, "role_not_found");
        if (role.system && !allowed(c, "roles.manage", organizationId))
          return fail(c, 403, "forbidden");
        const added = await organizations.addMembership({
          userId,
          roleId: role.id,
        });
        if (!added.ok) return fail(c, 404, added.error.kind);
        await trace(c, organizationId, "member.role_add", userId, {
          roleId: role.id,
        });
        return c.json({ ok: true, id: userId });
      },
    )
    .delete(
      "/organizations/:id/members/:userId/roles/:roleId",
      zValidator("param", z.object({ id: uuid, userId: uuid, roleId: uuid })),
      async (c) => {
        const params = c.req.valid("param");
        const organizationId = asOrganizationId(params.id);
        if (!allowed(c, "members.manage", organizationId))
          return fail(c, 403, "forbidden");
        const role = await organizations.getRole(asRoleId(params.roleId));
        if (!role || role.organizationId !== organizationId)
          return fail(c, 404, "role_not_found");
        if (role.system && !allowed(c, "roles.manage", organizationId))
          return fail(c, 403, "forbidden");
        const userId = asUserId(params.userId);
        const removed = await organizations.removeMembership({
          userId,
          roleId: role.id,
        });
        if (!removed.ok) return fail(c, 409, removed.error.kind);
        await trace(c, organizationId, "member.role_remove", userId, {
          roleId: role.id,
        });
        return c.json({ ok: true, id: userId });
      },
    )
    .post(
      "/organizations/:id/members/:userId/login-code",
      zValidator("param", z.object({ id: uuid, userId: uuid })),
      async (c) => {
        const params = c.req.valid("param");
        const organizationId = asOrganizationId(params.id);
        if (!allowed(c, "members.manage", organizationId))
          return fail(c, 403, "forbidden");
        const userId = asUserId(params.userId);
        const isMember = (await organizations.listMembers(organizationId)).some(
          (m) => m.userId === userId,
        );
        const accounts = createAccountStore(deps.db);
        const identity = (await accounts.listIdentities(userId)).find(
          (i) => i.kind === "username",
        );
        if (!isMember || !identity) return fail(c, 404, "not_found");
        const loginCode = generateLoginCode();
        await accounts.setIdentitySecret(
          identity.id,
          await hashPassword(loginCode),
        );
        await trace(c, organizationId, "member.login_code", userId);
        return c.json({ ok: true, loginCode });
      },
    )
    .get(
      "/audit",
      zValidator("query", z.object({ organizationId: uuid.optional() })),
      async (c) => {
        const query = c.req.valid("query");
        const organizationId = query.organizationId
          ? asOrganizationId(query.organizationId)
          : undefined;
        if (organizationId) {
          if (!allowed(c, "audit.read", organizationId))
            return fail(c, 403, "forbidden");
        } else {
          // Le journal complet est réservé à l'équipe Wema.
          const platform = c
            .get("memberships")
            .some(
              (m) =>
                m.organizationKind === "platform" &&
                m.permissions.includes("audit.read"),
            );
          if (!platform) return fail(c, 403, "forbidden");
        }
        return c.json(
          {
            entries: await audit.list({
              ...(organizationId ? { organizationId } : {}),
              limit: 200,
            }),
          },
          200,
        );
      },
    );
}
