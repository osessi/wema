import { zValidator } from "@hono/zod-validator";
import {
  foldName,
  generateLoginCode,
  hashPassword,
  normalizeEmail,
  parseRoster,
  passwordWorkSaturated,
  ROSTER_MAX_BYTES,
  type RosterRow,
  type RosterRowError,
  usernameBase,
  usernameCandidates,
} from "@wema/access";
import {
  createAccountStore,
  createAuditLog,
  createClassStore,
  createOrganizationStore,
  type SchoolClass,
  type SqlExecutor,
} from "@wema/db";
import {
  asOrganizationId,
  asUserId,
  DEFAULT_ROLES,
  type Organization,
  type OrganizationId,
  type Role,
  type UserId,
} from "@wema/domain";
import { type Context, Hono } from "hono";
import { z } from "zod";
import type { Deps, Env } from "../context";
import { allowed, fail, requireSession } from "../http";
import { createRateLimiter } from "../rate-limit";

const uuid = z.uuid();
/** Imports en masse au plus par personne et par jour. */
const IMPORTS_PER_DAY = 30;
/** Aperçus au plus par personne et par heure (relus à chaque modification de la liste). */
const PREVIEWS_PER_HOUR = 120;
const HOUR_MS = 60 * 60 * 1000;
/** Comptes parents créés un par un au plus par personne et par jour. */
const GUARDIANS_PER_DAY = 200;
const DAY_MS = 24 * 60 * 60 * 1000;
/**
 * Calculs de code chiffré menés en même temps pendant un import : on laisse
 * de la place aux connexions (la file en accepte 4, voir @wema/access).
 */
const HASH_CONCURRENCY = 2;

/** Identifiant du parent pris pendant la création : la transaction est annulée. */
class GuardianLoginTaken extends Error {}

export interface GuardianLogin {
  login: string;
  kind: "email" | "username";
}

/** Erreurs de ligne vues côté serveur, en plus de celles du texte. */
// L'aperçu ne dit jamais si un e-mail a déjà un compte Wema (énumération).
export type RosterCheckError =
  | RosterRowError
  | "class_not_found"
  | "already_member";

/**
 * Sort du compte parent d'une ligne à l'import : `linked` (parent existant,
 * déjà lié à l'organisation, rattaché), `not_created` (message générique,
 * le même que le compte existe ou non) ; absent quand le compte est créé.
 */
export type ParentNotice = "linked" | "not_created";

export interface CheckedRow extends Omit<RosterRow, "errors"> {
  errors: RosterCheckError[];
  classId: string | null;
}

/** Rôle d'élève de l'organisation : celui du modèle, sinon le plus modeste. */
export function learnerRole(
  organization: Organization,
  roles: readonly Role[],
): Role | null {
  const kind = organization.kind === "platform" ? null : organization.kind;
  const learnerName = kind
    ? DEFAULT_ROLES[kind].find((r) => r.learner)?.name
    : undefined;
  return (
    roles
      .filter(
        (r) =>
          !r.system &&
          !r.permissions.includes("members.manage") &&
          !r.permissions.includes("exercises.write"),
      )
      .sort(
        (a, b) =>
          Number(b.name === learnerName) - Number(a.name === learnerName) ||
          a.permissions.length - b.permissions.length,
      )[0] ?? null
  );
}

/** Fait `fn` sur chaque élément, `limit` à la fois, dans l'ordre. */
async function inBatches<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += limit)
    out.push(...(await Promise.all(items.slice(i, i + limit).map(fn))));
  return out;
}

/** Ajoute le premier identifiant libre de la liste ; null si tous sont pris. */
async function addFreeUsername(
  tx: SqlExecutor,
  userId: UserId,
  base: string,
  secretHash: string,
): Promise<string | null> {
  const accounts = createAccountStore(tx);
  for (const candidate of usernameCandidates(base)) {
    const added = await accounts.addIdentity({
      userId,
      kind: "username",
      identifier: candidate,
      secretHash,
      verified: false,
    });
    if (added) return candidate;
  }
  return null;
}

/**
 * Compte parent créé par l'école ou le prof : une famille à lui, où il est
 * parent et l'élève enfant, avec le lien parent-enfant (comme le parcours
 * famille). Connexion par identifiant et code (jamais par l'e-mail saisi).
 */
async function createGuardian(
  tx: SqlExecutor,
  input: {
    actor: UserId;
    from: OrganizationId;
    learners: readonly { userId: UserId; displayName: string }[];
    email: string | null;
    usernameBase: string;
    secretHash: string;
  },
): Promise<GuardianLogin | null> {
  const first = input.learners[0];
  if (!first) return null;
  const orgs = createOrganizationStore(tx);
  const accounts = createAccountStore(tx);
  const family = await orgs.createOrganization({
    name: `Famille de ${first.displayName}`,
    kind: "family",
    defaultRoles: true,
  });
  const roles = await orgs.listRoles(family.id);
  const parentRole = roles.find((r) =>
    r.permissions.includes("members.manage"),
  );
  const childRole = learnerRole(family, roles);
  if (!parentRole || !childRole) throw new Error("rôles de famille manquants");
  const parent = await accounts.createUser({
    displayName: `Parent de ${first.displayName}`,
    createdBy: input.actor,
    ownerOrganizationId: family.id,
  });
  // Toujours un identifiant, jamais l'e-mail saisi par l'organisation : un
  // compte lié à une adresse non confirmée par son titulaire permettrait de la
  // « réserver » à sa place (pré-détournement de compte).
  const login = await addFreeUsername(
    tx,
    parent.id,
    input.usernameBase,
    input.secretHash,
  );
  // E-mail pris entre la vérification et l'écriture : on annule tout.
  if (!login) throw new GuardianLoginTaken();
  const added = await orgs.addMembership({
    userId: parent.id,
    roleId: parentRole.id,
  });
  if (!added.ok) throw new Error(added.error.kind);
  const audit = createAuditLog(tx);
  for (const learner of input.learners) {
    const child = await orgs.addMembership({
      userId: learner.userId,
      roleId: childRole.id,
    });
    if (!child.ok) throw new Error(child.error.kind);
    await createClassStore(tx).link({
      organizationId: family.id,
      guardianId: parent.id,
      learnerId: learner.userId,
    });
    for (const organizationId of [input.from, family.id])
      await audit.append({
        actorId: input.actor,
        organizationId,
        action: "guardianship.create",
        targetType: "guardianship",
        targetId: learner.userId,
        details: { guardianId: parent.id, createdBy: input.from },
      });
  }
  return { login, kind: "username" };
}

/**
 * Rattache des élèves à un parent existant, seulement s'il est déjà parent
 * d'un élève de cette organisation : dans sa propre famille, avec le lien
 * parent-enfant. Sinon `false`, sans rien écrire.
 */
async function linkExistingGuardian(
  tx: SqlExecutor,
  input: {
    actor: UserId;
    from: OrganizationId;
    guardianId: UserId;
    learners: readonly { userId: UserId }[];
  },
): Promise<boolean> {
  const { rows } = await tx.query<{ organization_id: string }>(
    `SELECT f.id AS organization_id FROM memberships m
     JOIN organizations f ON f.id = m.organization_id AND f.kind = 'family'
     JOIN roles r ON r.id = m.role_id AND 'members.manage' = ANY(r.permissions)
     WHERE m.user_id = $1
       AND EXISTS (
         SELECT 1 FROM guardianships g
         JOIN memberships gm ON gm.organization_id = g.organization_id AND gm.user_id = g.guardian_id
         JOIN memberships lm ON lm.organization_id = g.organization_id AND lm.user_id = g.learner_id
         JOIN memberships om ON om.user_id = g.learner_id AND om.organization_id = $2
         WHERE g.guardian_id = $1)
     ORDER BY f.created_at, f.id LIMIT 1`,
    [input.guardianId, input.from],
  );
  const familyId = rows[0]?.organization_id;
  if (!familyId) return false;
  const orgs = createOrganizationStore(tx);
  const family = await orgs.getOrganization(asOrganizationId(familyId));
  const childRole = family
    ? learnerRole(family, await orgs.listRoles(family.id))
    : null;
  if (!family || !childRole) return false;
  const audit = createAuditLog(tx);
  for (const learner of input.learners) {
    const child = await orgs.addMembership({
      userId: learner.userId,
      roleId: childRole.id,
    });
    if (!child.ok) throw new Error(child.error.kind);
    await createClassStore(tx).link({
      organizationId: family.id,
      guardianId: input.guardianId,
      learnerId: learner.userId,
    });
    for (const organizationId of [input.from, family.id])
      await audit.append({
        actorId: input.actor,
        organizationId,
        action: "guardianship.create",
        targetType: "guardianship",
        targetId: learner.userId,
        details: { guardianId: input.guardianId, createdBy: input.from },
      });
  }
  return true;
}

/**
 * Inscription d'élèves en masse par une école ou un prof particulier : aperçu
 * ligne par ligne, puis création des comptes (identifiant et code), dans leur
 * classe, avec s'il le faut le compte du parent. Les codes ne sont rendus
 * qu'une fois, pour la fiche à imprimer.
 */
export function rosterRoutes(deps: Deps) {
  const organizations = createOrganizationStore(deps.db);
  const classes = createClassStore(deps.db);
  const imports = createRateLimiter({
    max: IMPORTS_PER_DAY,
    windowMs: DAY_MS,
    now: deps.now,
  });
  const previews = createRateLimiter({
    max: PREVIEWS_PER_HOUR,
    windowMs: HOUR_MS,
    now: deps.now,
  });
  const guardians = createRateLimiter({
    max: GUARDIANS_PER_DAY,
    windowMs: DAY_MS,
    now: deps.now,
  });

  /** École ou réseau de profs dont l'utilisateur gère les membres. */
  const managed = async (c: Context<Env>, id: string) => {
    const organizationId = asOrganizationId(id);
    if (!allowed(c, "members.manage", organizationId)) return null;
    const org = await organizations.getOrganization(organizationId);
    return org && (org.kind === "school" || org.kind === "tutoring")
      ? org
      : null;
  };

  /**
   * Relit le texte et le confronte à la base (classes, membres). L'existence
   * d'un compte pour l'e-mail d'un parent n'est jamais consultée ici.
   */
  const check = async (
    org: Organization,
    text: string,
    defaultClassId: string | null,
  ) => {
    const parsed = parseRoster(text);
    if (!parsed.ok) return parsed;
    const orgClasses = await classes.listClasses(org.id);
    const byName = new Map(orgClasses.map((k) => [foldName(k.name), k]));
    const members = new Set(
      (await organizations.listMembers(org.id)).map((m) =>
        foldName(m.displayName),
      ),
    );
    const fallback = defaultClassId
      ? (orgClasses.find((k) => k.id === defaultClassId) ?? null)
      : null;
    const rows: CheckedRow[] = parsed.value.map((r) => {
      const errors: RosterCheckError[] = [...r.errors];
      let klass: SchoolClass | null = fallback;
      if (r.className) {
        klass = byName.get(foldName(r.className)) ?? null;
        if (!klass) errors.push("class_not_found");
      }
      if (members.has(foldName(`${r.firstName} ${r.lastName}`)))
        errors.push("already_member");
      return { ...r, errors, classId: klass?.id ?? null };
    });
    return { ok: true as const, value: { rows, classes: orgClasses } };
  };

  const rosterBody = z.object({
    // La taille exacte (octets) est vérifiée par le lecteur ; ici, une borne large.
    text: z.string().max(ROSTER_MAX_BYTES),
    classId: uuid.nullable().default(null),
  });

  return new Hono<Env>()
    .use(requireSession(deps))
    .post(
      "/organizations/:id/roster/preview",
      zValidator("param", z.object({ id: uuid })),
      zValidator("json", rosterBody),
      async (c) => {
        const org = await managed(c, c.req.valid("param").id);
        if (!org) return fail(c, 403, "forbidden");
        const body = c.req.valid("json");
        if (body.classId && !allowed(c, "classes.manage", org.id))
          return fail(c, 403, "forbidden");
        if (!previews.hit(c.get("user").id))
          return fail(c, 429, "too_many_attempts");
        const checked = await check(org, body.text, body.classId);
        if (!checked.ok) return fail(c, 422, checked.error.kind, checked.error);
        return c.json(
          {
            rows: checked.value.rows.map((r) => ({
              line: r.line,
              firstName: r.firstName,
              lastName: r.lastName,
              className:
                checked.value.classes.find((k) => k.id === r.classId)?.name ??
                r.className,
              parentEmail: r.parentEmail,
              username: usernameBase(r.firstName, r.lastName),
              errors: r.errors,
              duplicateOf: r.duplicateOf ?? null,
            })),
          },
          200,
        );
      },
    )
    .post(
      "/organizations/:id/roster/import",
      zValidator("param", z.object({ id: uuid })),
      zValidator(
        "json",
        rosterBody.extend({
          /** Crée le compte du parent des élèves dont l'e-mail est donné. */
          createParents: z.boolean().default(false),
        }),
      ),
      async (c) => {
        const org = await managed(c, c.req.valid("param").id);
        if (!org) return fail(c, 403, "forbidden");
        const body = c.req.valid("json");
        const canEnroll = allowed(c, "classes.manage", org.id);
        if (body.classId && !canEnroll) return fail(c, 403, "forbidden");
        const role = learnerRole(org, await organizations.listRoles(org.id));
        if (!role) return fail(c, 422, "role_not_found");
        if (!role.permissions.every((p) => allowed(c, p, org.id)))
          return fail(c, 403, "forbidden");
        const checked = await check(org, body.text, body.classId);
        if (!checked.ok) return fail(c, 422, checked.error.kind, checked.error);
        const rows = checked.value.rows;
        // Tout ou rien : aucune ligne en erreur.
        if (rows.some((r) => r.errors.length > 0))
          return fail(c, 422, "roster_invalid");
        if (rows.some((r) => r.classId) && !canEnroll)
          return fail(c, 403, "forbidden");
        const actor = c.get("user").id;
        if (!imports.hit(actor)) return fail(c, 429, "too_many_attempts");
        if (passwordWorkSaturated()) {
          c.header("Retry-After", "2");
          return fail(c, 503, "server_busy");
        }

        // Un parent par e-mail : frères et sœurs partagent le même compte.
        const parentEmails = body.createParents
          ? [...new Set(rows.flatMap((r) => r.parentEmail ?? []))]
          : [];
        // Codes et empreintes calculés avant la transaction (lents).
        const secrets = await inBatches(
          [...rows.map(() => null), ...parentEmails],
          HASH_CONCURRENCY,
          async () => {
            const code = generateLoginCode();
            return { code, hash: await hashPassword(code) };
          },
        );
        const result = await deps.db
          .transaction(async (tx) => {
            const accounts = createAccountStore(tx);
            const orgs = createOrganizationStore(tx);
            const store = createClassStore(tx);
            const audit = createAuditLog(tx);
            const created: {
              userId: UserId;
              displayName: string;
              className: string | null;
              username: string;
              code: string;
              parentEmail: string | null;
              parent: (GuardianLogin & { code: string }) | null;
              parentNotice: ParentNotice | null;
            }[] = [];
            for (const [i, r] of rows.entries()) {
              const secret = secrets[i];
              if (!secret) throw new Error("code manquant");
              const displayName = `${r.firstName} ${r.lastName}`;
              const user = await accounts.createUser({
                displayName,
                createdBy: actor,
                ownerOrganizationId: org.id,
              });
              const username = await addFreeUsername(
                tx,
                user.id,
                usernameBase(r.firstName, r.lastName),
                secret.hash,
              );
              if (!username) throw new Error("aucun identifiant libre");
              const added = await orgs.addMembership({
                userId: user.id,
                roleId: role.id,
              });
              if (!added.ok) throw new Error(added.error.kind);
              if (r.classId)
                await store.addMember({
                  classId: r.classId,
                  userId: user.id,
                  role: "learner",
                });
              await audit.append({
                actorId: actor,
                organizationId: org.id,
                action: "member.add",
                targetType: "member",
                targetId: user.id,
                details: {
                  roleId: role.id,
                  loginKind: "username",
                  classId: r.classId,
                  bulk: true,
                },
              });
              created.push({
                userId: user.id,
                displayName,
                className:
                  checked.value.classes.find((k) => k.id === r.classId)?.name ??
                  null,
                username,
                code: secret.code,
                parentEmail: r.parentEmail,
                parent: null,
                parentNotice: null,
              });
            }
            for (const [j, email] of parentEmails.entries()) {
              const secret = secrets[rows.length + j];
              if (!secret) throw new Error("code manquant");
              const children = created.filter((k) => k.parentEmail === email);
              // E-mail déjà inscrit : on rattache le parent s'il est déjà lié à
              // l'organisation ; sinon, rien n'est créé et le message reste
              // générique (il ne dit pas si le compte existe).
              const existing = await accounts.findIdentity("email", email);
              if (existing) {
                const linked = await linkExistingGuardian(tx, {
                  actor,
                  from: org.id,
                  guardianId: existing.userId,
                  learners: children,
                });
                for (const k of children)
                  k.parentNotice = linked ? "linked" : "not_created";
                continue;
              }
              const parent = await createGuardian(tx, {
                actor,
                from: org.id,
                learners: children,
                email,
                usernameBase:
                  `parent.${children[0]?.username ?? "famille"}`.slice(0, 28),
                secretHash: secret.hash,
              });
              if (parent)
                for (const k of children)
                  k.parent = { ...parent, code: secret.code };
            }
            return created;
          })
          .catch((e: unknown) => {
            if (e instanceof GuardianLoginTaken) return null;
            throw e;
          });
        // E-mail pris pendant l'import (course) : rien n'est créé, sans dire pourquoi.
        if (!result) return fail(c, 409, "roster_conflict");
        return c.json(
          {
            ok: true,
            created: result.map((k) => ({
              userId: k.userId,
              displayName: k.displayName,
              className: k.className,
              username: k.username,
              code: k.code,
              parent: k.parent,
              parentNotice: k.parentNotice,
            })),
          },
          201,
        );
      },
    )
    .post(
      "/organizations/:id/learners/:userId/guardian",
      zValidator("param", z.object({ id: uuid, userId: uuid })),
      zValidator(
        "json",
        z.object({ email: z.string().max(254).nullable().default(null) }),
      ),
      async (c) => {
        const params = c.req.valid("param");
        const org = await managed(c, params.id);
        if (!org) return fail(c, 403, "forbidden");
        const learnerId = asUserId(params.userId);
        const accounts = createAccountStore(deps.db);
        // Seulement un élève que cette organisation a inscrit elle-même.
        const learner = await accounts.getUser(learnerId);
        if (
          !learner ||
          (await accounts.ownerOrganization(learnerId)) !== org.id ||
          !(await organizations.isMember(org.id, learnerId))
        )
          return fail(c, 404, "not_found");
        // Le limiteur passe avant toute recherche de compte (énumération).
        const actor = c.get("user").id;
        if (!guardians.hit(actor)) return fail(c, 429, "too_many_attempts");
        let email: string | null = null;
        const raw = c.req.valid("json").email?.trim();
        if (raw) {
          const normalized = normalizeEmail(raw);
          if (!normalized.ok) return fail(c, 422, normalized.error.kind);
          email = normalized.value;
        }
        // E-mail déjà inscrit : rattaché s'il est déjà parent d'un élève de
        // l'organisation ; sinon réponse générique, qui ne dit pas pourquoi.
        const notCreated = (notice: ParentNotice) =>
          c.json({ ok: true, parentNotice: notice }, 200);
        const existing = email
          ? await accounts.findIdentity("email", email)
          : null;
        if (existing) {
          const linked = await deps.db.transaction((tx) =>
            linkExistingGuardian(tx, {
              actor,
              from: org.id,
              guardianId: existing.userId,
              learners: [{ userId: learnerId }],
            }),
          );
          return notCreated(linked ? "linked" : "not_created");
        }
        if (passwordWorkSaturated()) {
          c.header("Retry-After", "2");
          return fail(c, 503, "server_busy");
        }
        const learnerLogin = (await accounts.listIdentities(learnerId)).find(
          (i) => i.kind === "username",
        )?.identifier;
        const code = generateLoginCode();
        const secretHash = await hashPassword(code);
        const parent = await deps.db
          .transaction((tx) =>
            createGuardian(tx, {
              actor,
              from: org.id,
              learners: [
                { userId: learnerId, displayName: learner.displayName },
              ],
              email,
              usernameBase:
                `parent.${learnerLogin ?? usernameBase(learner.displayName, "")}`.slice(
                  0,
                  28,
                ),
              secretHash,
            }),
          )
          .catch((e: unknown) => {
            if (e instanceof GuardianLoginTaken) return null;
            throw e;
          });
        // E-mail pris entre-temps : même réponse générique.
        if (!parent && email) return notCreated("not_created");
        if (!parent) return fail(c, 409, "identifier_taken");
        return c.json({ ok: true, ...parent, code }, 201);
      },
    );
}
