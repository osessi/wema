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
  type SqlExecutor,
} from "@wema/db";
import {
  asOrganizationId,
  asRoleId,
  asUserId,
  isPermission,
  type OrganizationId,
  type Permission,
  type Role,
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

/** Membre de l'équipe Wema qui gère les membres : il peut assister toutes les organisations. */
function isPlatformStaff(c: Context<Env>): boolean {
  return c
    .get("memberships")
    .some(
      (m) =>
        m.organizationKind === "platform" &&
        m.permissions.includes("members.manage"),
    );
}

/**
 * On ne donne (ni ne retire, ni ne compose) que des permissions qu'on détient
 * soi-même dans l'organisation : sinon, gérer les membres suffirait pour
 * s'attribuer un rôle plus puissant.
 */
function withinOwnPermissions(
  c: Context<Env>,
  organizationId: OrganizationId,
  wanted: readonly Permission[],
): boolean {
  return wanted.every((p) => allowed(c, p, organizationId));
}

export function organizationRoutes(deps: Deps) {
  const organizations = createOrganizationStore(deps.db);

  /** Trace une action dans la même transaction que l'écriture. */
  const trace = (
    tx: SqlExecutor,
    c: Context<Env>,
    organizationId: OrganizationId,
    action: string,
    targetId: string,
    details: Record<string, unknown> = {},
  ) =>
    createAuditLog(tx).append({
      actorId: c.get("user").id,
      organizationId,
      action,
      targetType: action.split(".")[0] ?? action,
      targetId,
      details,
    });

  /** Rôle de l'organisation que l'acteur a le droit d'attribuer ou de retirer. */
  const assignableRole = async (
    c: Context<Env>,
    organizationId: OrganizationId,
    roleId: string,
  ): Promise<
    { ok: true; role: Role } | { ok: false; status: 403 | 422; code: string }
  > => {
    const role = await organizations.getRole(asRoleId(roleId));
    if (!role || role.organizationId !== organizationId)
      return { ok: false, status: 422, code: "role_not_found" };
    if (!withinOwnPermissions(c, organizationId, role.permissions)) {
      return { ok: false, status: 403, code: "forbidden" };
    }
    return { ok: true, role };
  };

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
        const body = c.req.valid("json");
        const org = await deps.db.transaction(async (tx) => {
          const created =
            await createOrganizationStore(tx).createOrganization(body);
          await trace(
            tx,
            c,
            created.id,
            "organization.create",
            created.id,
            body,
          );
          return created;
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
        if (!withinOwnPermissions(c, id, body.permissions))
          return fail(c, 403, "forbidden");
        const role = await deps.db.transaction(async (tx) => {
          const created = await createOrganizationStore(tx).createRole({
            organizationId: id,
            ...body,
          });
          if (created.ok)
            await trace(tx, c, id, "role.create", created.value.id, body);
          return created;
        });
        if (!role.ok) return fail(c, 409, role.error.kind);
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
        if (
          !role.system &&
          !withinOwnPermissions(c, role.organizationId, body.permissions)
        ) {
          return fail(c, 403, "forbidden");
        }
        const updated = await deps.db.transaction(async (tx) => {
          const result = await createOrganizationStore(tx).updateRole(
            role.id,
            body,
          );
          if (result.ok)
            await trace(
              tx,
              c,
              role.organizationId,
              "role.update",
              role.id,
              body,
            );
          return result;
        });
        if (!updated.ok)
          return fail(
            c,
            updated.error.kind === "role_not_found" ? 404 : 409,
            updated.error.kind,
          );
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
        const deleted = await deps.db.transaction(async (tx) => {
          const result = await createOrganizationStore(tx).deleteRole(role.id);
          if (result.ok)
            await trace(tx, c, role.organizationId, "role.delete", role.id, {
              name: role.name,
            });
          return result;
        });
        if (!deleted.ok) return fail(c, 409, deleted.error.kind);
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
        const assignable = await assignableRole(c, organizationId, body.roleId);
        if (!assignable.ok) return fail(c, assignable.status, assignable.code);
        const role = assignable.role;

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

        // Rattacher un compte existant sans son accord exposerait ses données
        // à l'organisation : seule l'équipe Wema peut le faire (assistance),
        // en attendant les invitations.
        const staff = isPlatformStaff(c);
        const actor = c.get("user").id;
        const result = await deps.db.transaction(async (tx) => {
          const accounts = createAccountStore(tx);
          const existing = await accounts.findIdentity(
            identifier.kind,
            identifier.value,
          );
          if (existing && (identifier.kind === "username" || !staff))
            return { kind: "identifier_taken" as const };
          let userId: UserId;
          if (existing) {
            userId = existing.userId;
          } else {
            userId = (
              await accounts.createUser({
                displayName: body.displayName,
                createdBy: actor,
                ownerOrganizationId: organizationId,
              })
            ).id;
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
          await trace(tx, c, organizationId, "member.add", userId, {
            roleId: role.id,
            existingAccount: existing !== null,
            loginKind: identifier.kind,
          });
          return { kind: "ok" as const, userId };
        });
        if (result.kind === "identifier_taken")
          return fail(c, 409, "identifier_taken");
        // Le code de connexion d'un compte élève n'est montré qu'une fois.
        return c.json({ ok: true, userId: result.userId, loginCode }, 201);
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
        if (userId === c.get("user").id) return fail(c, 403, "forbidden");
        // On ne donne un rôle qu'à quelqu'un qui est déjà membre de l'organisation.
        if (!(await organizations.isMember(organizationId, userId)))
          return fail(c, 404, "not_found");
        const assignable = await assignableRole(
          c,
          organizationId,
          c.req.valid("json").roleId,
        );
        if (!assignable.ok) return fail(c, assignable.status, assignable.code);
        const role = assignable.role;
        const added = await deps.db.transaction(async (tx) => {
          const result = await createOrganizationStore(tx).addMembership({
            userId,
            roleId: role.id,
          });
          if (result.ok)
            await trace(tx, c, organizationId, "member.role_add", userId, {
              roleId: role.id,
            });
          return result;
        });
        if (!added.ok) return fail(c, 404, added.error.kind);
        return c.json({ ok: true, id: userId });
      },
    )
    .delete(
      "/organizations/:id/members/:userId/roles/:roleId",
      zValidator("param", z.object({ id: uuid, userId: uuid, roleId: uuid })),
      async (c) => {
        const params = c.req.valid("param");
        const organizationId = asOrganizationId(params.id);
        const userId = asUserId(params.userId);
        if (!allowed(c, "members.manage", organizationId))
          return fail(c, 403, "forbidden");
        if (userId === c.get("user").id) return fail(c, 403, "forbidden");
        const assignable = await assignableRole(
          c,
          organizationId,
          params.roleId,
        );
        if (!assignable.ok)
          return fail(
            c,
            assignable.status === 422 ? 404 : 403,
            assignable.code,
          );
        const role = assignable.role;
        const removed = await deps.db.transaction(async (tx) => {
          const result = await createOrganizationStore(tx).removeMembership({
            userId,
            roleId: role.id,
          });
          if (result.ok)
            await trace(tx, c, organizationId, "member.role_remove", userId, {
              roleId: role.id,
            });
          return result;
        });
        if (!removed.ok) return fail(c, 409, removed.error.kind);
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
        const accounts = createAccountStore(deps.db);
        // Seule l'organisation qui a créé le compte (ou l'équipe Wema) en
        // change le code : une autre organisation ne peut pas en prendre le contrôle.
        const owner = await accounts.ownerOrganization(userId);
        const identity = (await accounts.listIdentities(userId)).find(
          (i) => i.kind === "username",
        );
        const isMember = await organizations.isMember(organizationId, userId);
        if (
          !isMember ||
          !identity ||
          (owner !== organizationId && !isPlatformStaff(c))
        ) {
          return fail(c, 404, "not_found");
        }
        const loginCode = generateLoginCode();
        const secretHash = await hashPassword(loginCode);
        await deps.db.transaction(async (tx) => {
          const store = createAccountStore(tx);
          await store.setIdentitySecret(identity.id, secretHash);
          // L'ancien code a peut-être fuité : on ferme aussi les sessions ouvertes avec.
          await store.deleteUserSessions(userId);
          await trace(tx, c, organizationId, "member.login_code", userId);
        });
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
        const entries = await createAuditLog(deps.db).list({
          ...(organizationId ? { organizationId } : {}),
          limit: 200,
        });
        return c.json({ entries }, 200);
      },
    );
}
