import { zValidator } from "@hono/zod-validator";
import {
  checkPasswordRules,
  generateLoginCode,
  hashPassword,
  normalizeEmail,
  normalizeUsername,
} from "@wema/access";
import {
  createAccountStore,
  createAuditLog,
  createClassStore,
  createLearnerProgramStore,
  createOrganizationStore,
  type SqlExecutor,
} from "@wema/db";
import {
  asLearnerId,
  asOrganizationId,
  asProgramId,
  asUserId,
  DEFAULT_ROLES,
  type OrganizationId,
  type Role,
  type UserId,
} from "@wema/domain";
import { effectivePrograms } from "@wema/orchestrator";
import { type Context, Hono } from "hono";
import { z } from "zod";
import type { Deps, Env } from "../context";
import { fail, requireSession } from "../http";
import { createRateLimiter } from "../rate-limit";
import { recordGuardianLinkConsent } from "./account";

const uuid = z.uuid();
/** Enfants au plus par famille créés par ce parcours (au-delà : l'équipe Wema). */
export const MAX_CHILDREN_PER_FAMILY = 10;
/** Comptes d'enfants créés au plus par parent et par jour. */
const CHILDREN_PER_DAY = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

const programIds = z.array(uuid).max(10);

/** Moyen de connexion de l'enfant : identifiant (code affiché une fois) ou e-mail. */
const childLogin = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("username"), username: z.string() }),
  z.object({
    kind: z.literal("email"),
    email: z.string(),
    password: z.string(),
  }),
]);

/** Choix de programme refusé pendant la création d'un enfant (annule la transaction). */
class ProgramChoiceError extends Error {
  constructor(readonly kind: "program_not_found" | "programs_conflict") {
    super(kind);
  }
}

/**
 * Rôle d'enfant de la famille : de préférence celui du modèle (« Enfant »),
 * sinon le rôle le plus modeste qui ne gère pas la famille (les rôles sont
 * modifiables : on ne dépend pas de leur nom).
 */
function childRole(roles: readonly Role[]): Role | null {
  const learnerName = DEFAULT_ROLES.family.find((r) => r.learner)?.name;
  const candidates = roles
    .filter((r) => !r.system && !r.permissions.includes("members.manage"))
    .sort(
      (a, b) =>
        Number(b.name === learnerName) - Number(a.name === learnerName) ||
        a.permissions.length - b.permissions.length,
    );
  return candidates[0] ?? null;
}

/**
 * Parcours famille autonome (fiche 0010) : un parent inscrit seul crée SA
 * famille, y ajoute ses enfants (avec le consentement parental) et choisit
 * pour chacun un programme du référentiel. Seuls les parents membres de la
 * famille agissent ici : l'équipe Wema passe par le back-office.
 */
export function familyRoutes(deps: Deps) {
  const organizations = createOrganizationStore(deps.db);
  const classes = createClassStore(deps.db);
  const programs = createLearnerProgramStore(deps.db);
  const accounts = createAccountStore(deps.db);
  const childLimiter = createRateLimiter({
    max: CHILDREN_PER_DAY,
    windowMs: DAY_MS,
    now: deps.now,
  });

  /** Familles que l'utilisateur gère lui-même (membre avec un rôle qui gère). */
  const managedFamilies = (c: Context<Env>) =>
    c
      .get("memberships")
      .filter(
        (m) =>
          m.organizationKind === "family" &&
          m.permissions.includes("members.manage"),
      )
      .map((m) => m.organizationId);

  const manages = (c: Context<Env>, id: OrganizationId) =>
    managedFamilies(c).includes(id);

  /** L'enfant est-il celui de ce parent, dans cette famille ? */
  const childInFamily = async (
    c: Context<Env>,
    organizationId: OrganizationId,
    learnerId: string,
  ) =>
    (await classes.childrenOf(c.get("user").id)).some(
      (k) => k.learnerId === learnerId && k.organizationId === organizationId,
    );

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

  return (
    new Hono<Env>()
      .use(requireSession(deps))
      // Ce qu'il faut pour le parcours : ses familles, ses enfants et leurs
      // programmes, et les programmes du référentiel à proposer.
      .get("/", async (c) => {
        const userId = c.get("user").id;
        const families = [];
        for (const id of [...new Set(managedFamilies(c))]) {
          const org = await organizations.getOrganization(id);
          if (org) families.push({ id: org.id, name: org.name });
        }
        const children = [];
        for (const k of await classes.childrenOf(userId)) {
          const list = effectivePrograms(
            await programs.programsOf(asLearnerId(k.learnerId)),
          );
          children.push({
            learnerId: k.learnerId,
            displayName: k.displayName,
            organizationId: k.organizationId,
            programs: list.map((p) => ({
              programId: p.programId,
              countryId: p.countryId,
              countryName: p.countryName,
              gradeId: p.gradeId,
              gradeName: p.gradeName,
              subjectId: p.subjectId,
              subjectName: p.subjectName,
              subjectIcon: p.subjectIcon,
              source: p.source,
              className: p.className,
            })),
          });
        }
        // Un compte créé pour quelqu'un (enfant, élève d'une école) ne fonde pas de famille.
        const managed = (await accounts.ownerOrganization(userId)) !== null;
        return c.json(
          {
            families,
            children,
            canCreate: families.length === 0 && !managed,
            catalog: await programs.catalog(),
          },
          200,
        );
      })
      .post(
        "/",
        zValidator(
          "json",
          z.object({ name: z.string().trim().min(1).max(200).optional() }),
        ),
        async (c) => {
          const user = c.get("user");
          if ((await accounts.ownerOrganization(user.id)) !== null)
            return fail(c, 403, "forbidden");
          const name =
            c.req.valid("json").name ?? `Famille de ${user.displayName}`;
          const result = await deps.db.transaction(async (tx) => {
            // Une famille par parent : deux envois simultanés n'en créent pas deux.
            await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
              `wema_family:${user.id}`,
            ]);
            const { rows } = await tx.query(
              `SELECT 1 FROM memberships m JOIN organizations o ON o.id = m.organization_id
               JOIN roles r ON r.id = m.role_id
               WHERE m.user_id = $1 AND o.kind = 'family' AND 'members.manage' = ANY(r.permissions)`,
              [user.id],
            );
            if (rows.length > 0) return null;
            const store = createOrganizationStore(tx);
            const org = await store.createOrganization({
              name,
              kind: "family",
              defaultRoles: true,
            });
            const parentRole = (await store.listRoles(org.id)).find((r) =>
              r.permissions.includes("members.manage"),
            );
            if (!parentRole) throw new Error("rôle de parent manquant");
            const added = await store.addMembership({
              userId: user.id,
              roleId: parentRole.id,
            });
            if (!added.ok) throw new Error(added.error.kind);
            await trace(tx, c, org.id, "organization.create", org.id, {
              kind: "family",
              selfService: true,
            });
            return org;
          });
          if (!result) return fail(c, 409, "family_exists");
          return c.json({ ok: true, id: result.id }, 201);
        },
      )
      .post(
        "/:id/children",
        zValidator("param", z.object({ id: uuid })),
        zValidator(
          "json",
          z.object({
            displayName: z.string().trim().min(1).max(120),
            login: childLogin,
            programIds,
          }),
        ),
        async (c) => {
          const organizationId = asOrganizationId(c.req.valid("param").id);
          if (!manages(c, organizationId)) return fail(c, 403, "forbidden");
          const body = c.req.valid("json");
          const actor = c.get("user").id;

          let identifier: { kind: "email" | "username"; value: string };
          let secretHash: string;
          let loginCode: string | null = null;
          if (body.login.kind === "email") {
            const email = normalizeEmail(body.login.email);
            if (!email.ok) return fail(c, 422, email.error.kind);
            const rules = checkPasswordRules(body.login.password);
            if (!rules.ok) return fail(c, 422, rules.error.kind);
            identifier = { kind: "email", value: email.value };
            secretHash = await hashPassword(body.login.password);
          } else {
            const username = normalizeUsername(body.login.username);
            if (!username.ok) return fail(c, 422, username.error.kind);
            identifier = { kind: "username", value: username.value };
            loginCode = generateLoginCode();
            secretHash = await hashPassword(loginCode);
          }
          const role = childRole(await organizations.listRoles(organizationId));
          if (!role) return fail(c, 422, "role_not_found");
          if (!childLimiter.hit(actor))
            return fail(c, 429, "too_many_attempts");

          const result = await deps.db
            .transaction(async (tx) => {
              await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
                `wema_family_children:${organizationId}`,
              ]);
              const { rows } = await tx.query<{ n: number }>(
                "SELECT count(DISTINCT learner_id)::int AS n FROM guardianships WHERE organization_id = $1",
                [organizationId],
              );
              if ((rows[0]?.n ?? 0) >= MAX_CHILDREN_PER_FAMILY)
                return { kind: "family_full" as const };
              const store = createAccountStore(tx);
              // Un compte existant n'est jamais rattaché sans son accord.
              if (await store.findIdentity(identifier.kind, identifier.value))
                return { kind: "identifier_taken" as const };
              const userId: UserId = (
                await store.createUser({
                  displayName: body.displayName,
                  createdBy: actor,
                  ownerOrganizationId: organizationId,
                })
              ).id;
              const identity = await store.addIdentity({
                userId,
                kind: identifier.kind,
                identifier: identifier.value,
                secretHash,
                verified: false,
              });
              if (!identity) return { kind: "identifier_taken" as const };
              const added = await createOrganizationStore(tx).addMembership({
                userId,
                roleId: role.id,
              });
              if (!added.ok) throw new Error(added.error.kind);
              await createClassStore(tx).link({
                organizationId,
                guardianId: actor,
                learnerId: userId,
              });
              // Le parent est l'auteur du lien : son consentement est enregistré (fiche 0008).
              await recordGuardianLinkConsent(tx, {
                guardianId: actor,
                learnerId: userId,
              });
              const chosen = await createLearnerProgramStore(tx).setPrograms({
                learnerId: asLearnerId(userId),
                organizationId,
                programIds: body.programIds.map(asProgramId),
                chosenBy: actor,
              });
              // Programme refusé : tout est annulé (pas de compte sans programme valable).
              if (!chosen.ok) throw new ProgramChoiceError(chosen.error.kind);
              await trace(tx, c, organizationId, "member.add", userId, {
                roleId: role.id,
                loginKind: identifier.kind,
                selfService: true,
              });
              await trace(
                tx,
                c,
                organizationId,
                "guardianship.create",
                userId,
                {
                  guardianId: actor,
                },
              );
              await trace(
                tx,
                c,
                organizationId,
                "learner_program.set",
                userId,
                {
                  programIds: chosen.programs.map((p) => p.programId),
                },
              );
              return { kind: "ok" as const, userId };
            })
            .catch((e: unknown) => {
              if (e instanceof ProgramChoiceError) return { kind: e.kind };
              throw e;
            });
          if (result.kind === "ok")
            // Le code de connexion de l'enfant n'est montré qu'une fois.
            return c.json({ ok: true, userId: result.userId, loginCode }, 201);
          if (result.kind === "family_full") return fail(c, 409, "family_full");
          if (result.kind === "identifier_taken")
            return fail(c, 409, "identifier_taken");
          return fail(c, 422, result.kind);
        },
      )
      .put(
        "/:id/children/:learnerId/programs",
        zValidator("param", z.object({ id: uuid, learnerId: uuid })),
        zValidator("json", z.object({ programIds })),
        async (c) => {
          const params = c.req.valid("param");
          const organizationId = asOrganizationId(params.id);
          if (!manages(c, organizationId)) return fail(c, 403, "forbidden");
          if (!(await childInFamily(c, organizationId, params.learnerId)))
            return fail(c, 404, "not_found");
          const ids = c.req.valid("json").programIds.map(asProgramId);
          const learnerId = asLearnerId(params.learnerId);
          const result = await deps.db.transaction(async (tx) => {
            const chosen = await createLearnerProgramStore(tx).setPrograms({
              learnerId,
              organizationId,
              programIds: ids,
              chosenBy: c.get("user").id,
            });
            if (chosen.ok)
              await trace(
                tx,
                c,
                organizationId,
                "learner_program.set",
                asUserId(params.learnerId),
                { programIds: chosen.programs.map((p) => p.programId) },
              );
            return chosen;
          });
          if (!result.ok) return fail(c, 422, result.error.kind);
          return c.json({ ok: true });
        },
      )
  );
}
