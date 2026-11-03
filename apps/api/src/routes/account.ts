import { zValidator } from "@hono/zod-validator";
import {
  createAccountStore,
  createAuditLog,
  createClassStore,
  createHealthStore,
  createOrganizationStore,
  createPrivacyStore,
  createSettingsStore,
  DEFAULT_PRIVACY_SETTINGS,
  exportUserData,
  loadPrivacySettings,
  PRIVACY_SETTINGS_KEY,
  type PrivacySettings,
  parsePrivacySettings,
  type SqlExecutor,
} from "@wema/db";
import {
  asLearnerId,
  asOrganizationId,
  asUserId,
  NEEDS,
  type UserId,
} from "@wema/domain";
import { type Context, Hono } from "hono";
import { z } from "zod";
import type { Deps, Env } from "../context";
import { allowed, fail, requirePermission, requireSession } from "../http";
import { explicableProfile } from "./profile";

// RGPD (fiche de décision 0008) : export, suppression avec délai de grâce,
// consentement parental, conditions acceptées, réglages de conservation.

const DAY_MS = 24 * 60 * 60 * 1000;
const uuid = z.uuid();
const confirmBody = z.object({ confirm: z.literal(true) });

/** Vrai si l'utilisateur doit accepter la version en vigueur des conditions. */
export async function mustAcceptTerms(
  db: SqlExecutor,
  userId: UserId,
): Promise<boolean> {
  const settings = await loadPrivacySettings(db);
  return !(await createPrivacyStore(db).hasAccepted({
    userId,
    termsVersion: settings.termsVersion,
    privacyVersion: settings.privacyVersion,
  }));
}

/** Versions en vigueur des conditions et de la politique de confidentialité. */
const versions = (s: PrivacySettings) => ({
  termsVersion: s.termsVersion,
  privacyVersion: s.privacyVersion,
});

/**
 * Consentement parental donné en créant soi-même le lien parent-enfant
 * (appelé par la route des liens familiaux).
 */
export async function recordGuardianLinkConsent(
  db: SqlExecutor,
  input: { guardianId: UserId; learnerId: UserId },
): Promise<void> {
  const settings = await loadPrivacySettings(db);
  await createPrivacyStore(db).recordParentalConsent({
    ...input,
    method: "guardian_link",
    ...versions(settings),
  });
}

/** Tout ce que Wema garde sur une personne, y compris ses besoins déclarés et son profil. */
async function fullExport(deps: Deps, userId: UserId) {
  const learnerId = asLearnerId(userId);
  const data = await exportUserData(deps.db, userId);
  const needs = (
    await createHealthStore(deps.db, deps.healthKey).list(learnerId)
  ).map((d) => ({
    need: d.need,
    label: NEEDS[d.need].label,
    active: d.active,
    declaredRole: d.declaredRole,
    consent: d.consent,
    consentAt: d.consentAt,
  }));
  const profile =
    data.learningEvents.length > 0
      ? await explicableProfile(deps.db, learnerId)
      : null;
  return {
    format: "wema-export",
    version: 1,
    exportedAt: deps.now().toISOString(),
    ...data,
    healthDeclarations: needs,
    profile,
  };
}

function download(c: Context, body: unknown, name: string) {
  c.header("content-disposition", `attachment; filename="${name}"`);
  c.header("cache-control", "no-store");
  return c.json(body, 200);
}

export function accountRoutes(deps: Deps) {
  const accounts = createAccountStore(deps.db);
  const privacy = createPrivacyStore(deps.db);
  const classes = createClassStore(deps.db);

  const audit = (
    actorId: UserId,
    action: string,
    targetId: UserId,
    details: Record<string, unknown> = {},
  ) =>
    createAuditLog(deps.db).append({
      actorId,
      organizationId: null,
      action,
      targetType: "account",
      targetId,
      details,
    });

  /** Enfant suivi par le parent connecté (lien en vigueur), ou `null`. */
  const childOf = async (guardianId: UserId, learnerId: string) =>
    (await classes.childrenOf(guardianId)).find(
      (child) => child.learnerId === learnerId,
    ) ?? null;

  /** Un compte d'élève mineur ne se supprime que par son parent. */
  const needsGuardian = async (userId: UserId) => {
    const { rows } = await deps.db.query<{
      guarded: boolean;
      managed: boolean;
    }>(
      `SELECT EXISTS (SELECT 1 FROM guardianships WHERE learner_id = $1) AS guarded,
         (u.created_by IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM identities i WHERE i.user_id = u.id AND i.kind <> 'username')) AS managed
       FROM users u WHERE u.id = $1`,
      [userId],
    );
    return rows[0]?.guarded === true || rows[0]?.managed === true;
  };

  const isLastSuperAdmin = async (userId: UserId) => {
    const { rows } = await deps.db.query(
      `SELECT 1 FROM memberships m JOIN roles r ON r.id = m.role_id
       JOIN organizations o ON o.id = r.organization_id
       WHERE m.user_id = $1 AND r.system AND o.kind = 'platform'`,
      [userId],
    );
    return (
      rows.length > 0 &&
      (await createOrganizationStore(deps.db).countSuperAdmins()) <= 1
    );
  };

  const schedule = async (
    userId: UserId,
    requestedBy: UserId,
    reason: "self" | "guardian",
  ) => {
    const settings = await loadPrivacySettings(deps.db);
    const pending = await privacy.requestDeletion({
      userId,
      requestedBy,
      reason,
      scheduledFor: new Date(
        deps.now().getTime() + settings.deletionGraceDays * DAY_MS,
      ),
    });
    await audit(requestedBy, "account.deletion_request", userId, { reason });
    return pending;
  };

  const deletionView = (
    d: Awaited<ReturnType<typeof privacy.pendingDeletion>>,
  ) =>
    d
      ? {
          reason: d.reason,
          requestedAt: d.requestedAt,
          scheduledFor: d.scheduledFor,
        }
      : null;

  return new Hono<Env>()
    .use(requireSession(deps))
    .get("/", async (c) => {
      const user = c.get("user");
      const settings = await loadPrivacySettings(deps.db);
      const children = await classes.childrenOf(user.id);
      const childViews = await Promise.all(
        children.map(async (child) => ({
          learnerId: child.learnerId,
          displayName: child.displayName,
          consents: (await privacy.consentsFor(asUserId(child.learnerId))).map(
            (p) => ({
              guardianName: p.guardianName,
              method: p.method,
              termsVersion: p.termsVersion,
              privacyVersion: p.privacyVersion,
              givenAt: p.givenAt,
              mine: p.guardianId === user.id,
            }),
          ),
          deletion: deletionView(
            await privacy.pendingDeletion(asUserId(child.learnerId)),
          ),
        })),
      );
      return c.json(
        {
          user: { id: user.id, displayName: user.displayName },
          identities: (await accounts.listIdentities(user.id)).map((i) => ({
            kind: i.kind,
            identifier: i.identifier,
          })),
          deletion: deletionView(await privacy.pendingDeletion(user.id)),
          deletionGraceDays: settings.deletionGraceDays,
          canDeleteSelf: !(await needsGuardian(user.id)),
          legal: {
            ...versions(settings),
            accepted: await privacy.lastAcceptance(user.id),
          },
          myConsents: (await privacy.consentsFor(user.id)).map((p) => ({
            guardianName: p.guardianName,
            givenAt: p.givenAt,
            termsVersion: p.termsVersion,
          })),
          children: childViews,
        },
        200,
      );
    })
    .get("/export", async (c) => {
      const user = c.get("user");
      await audit(user.id, "account.export", user.id);
      return download(
        c,
        await fullExport(deps, user.id),
        "wema-mes-donnees.json",
      );
    })
    .post(
      "/terms",
      zValidator(
        "json",
        z.object({
          termsVersion: z.string(),
          privacyVersion: z.string(),
        }),
      ),
      async (c) => {
        const body = c.req.valid("json");
        const settings = await loadPrivacySettings(deps.db);
        // On n'accepte que la version en vigueur (celle qui a été affichée).
        if (
          body.termsVersion !== settings.termsVersion ||
          body.privacyVersion !== settings.privacyVersion
        )
          return fail(c, 409, "terms_outdated");
        await privacy.acceptTerms({ userId: c.get("user").id, ...body });
        return c.json({ ok: true });
      },
    )
    .post("/deletion", zValidator("json", confirmBody), async (c) => {
      const user = c.get("user");
      if (await needsGuardian(user.id))
        return fail(c, 403, "guardian_required");
      if (await isLastSuperAdmin(user.id))
        return fail(c, 409, "last_super_admin");
      // Un parent supprime d'abord les comptes d'enfants qu'il a créés.
      const created = await deps.db.query(
        `SELECT 1 FROM guardianships g JOIN users u ON u.id = g.learner_id
         WHERE g.guardian_id = $1 AND u.created_by = $1 AND u.purged_at IS NULL
           AND NOT EXISTS (SELECT 1 FROM account_deletions d WHERE d.user_id = u.id
                           AND d.cancelled_at IS NULL AND d.completed_at IS NULL)`,
        [user.id],
      );
      if (created.rows.length > 0) return fail(c, 409, "children_first");
      const pending = await schedule(user.id, user.id, "self");
      return c.json({ ok: true, deletion: deletionView(pending) }, 201);
    })
    .delete("/deletion", async (c) => {
      const user = c.get("user");
      if (!(await privacy.cancelDeletion(user.id, deps.now())))
        return fail(c, 404, "not_found");
      await audit(user.id, "account.deletion_cancel", user.id);
      return c.json({ ok: true });
    })
    .get(
      "/children/:learnerId/export",
      zValidator("param", z.object({ learnerId: uuid })),
      async (c) => {
        const user = c.get("user");
        const child = await childOf(user.id, c.req.valid("param").learnerId);
        if (!child) return fail(c, 404, "not_found");
        await audit(user.id, "account.export", asUserId(child.learnerId));
        return download(
          c,
          await fullExport(deps, asUserId(child.learnerId)),
          "wema-donnees-enfant.json",
        );
      },
    )
    .post(
      "/children/:learnerId/deletion",
      zValidator("param", z.object({ learnerId: uuid })),
      zValidator("json", confirmBody),
      async (c) => {
        const user = c.get("user");
        const child = await childOf(user.id, c.req.valid("param").learnerId);
        if (!child) return fail(c, 404, "not_found");
        const pending = await schedule(
          asUserId(child.learnerId),
          user.id,
          "guardian",
        );
        return c.json({ ok: true, deletion: deletionView(pending) }, 201);
      },
    )
    .delete(
      "/children/:learnerId/deletion",
      zValidator("param", z.object({ learnerId: uuid })),
      async (c) => {
        const user = c.get("user");
        const child = await childOf(user.id, c.req.valid("param").learnerId);
        if (!child) return fail(c, 404, "not_found");
        const learnerId = asUserId(child.learnerId);
        if (!(await privacy.cancelDeletion(learnerId, deps.now())))
          return fail(c, 404, "not_found");
        await audit(user.id, "account.deletion_cancel", learnerId);
        return c.json({ ok: true });
      },
    )
    .post(
      "/children/:learnerId/consent",
      zValidator("param", z.object({ learnerId: uuid })),
      zValidator("json", confirmBody),
      async (c) => {
        const user = c.get("user");
        const child = await childOf(user.id, c.req.valid("param").learnerId);
        if (!child) return fail(c, 404, "not_found");
        const settings = await loadPrivacySettings(deps.db);
        await privacy.recordParentalConsent({
          learnerId: asUserId(child.learnerId),
          guardianId: user.id,
          method: "account",
          ...versions(settings),
        });
        await audit(
          user.id,
          "account.parental_consent",
          asUserId(child.learnerId),
        );
        return c.json({ ok: true }, 201);
      },
    );
}

/** Versions en vigueur, lisibles sans compte (pages légales, inscription). */
export function legalRoutes(deps: Deps) {
  return new Hono().get("/versions", async (c) => {
    const s = await loadPrivacySettings(deps.db);
    return c.json(
      {
        ...versions(s),
        // Durées affichées dans la politique de confidentialité.
        retention: {
          deletionGraceDays: s.deletionGraceDays,
          inactiveAccountDays: s.inactiveAccountDays,
          oneTimeCodeDays: s.oneTimeCodeDays,
          aiCallDays: s.aiCallDays,
          deliveryLogDays: s.deliveryLogDays,
          tutorConversationDays: s.tutorConversationDays,
        },
      },
      200,
    );
  });
}

/** Réglages RGPD du back-office et signalements pour les écoles. */
export function privacyAdminRoutes(deps: Deps) {
  return new Hono<Env>()
    .use(requireSession(deps))
    .get(
      "/settings",
      requirePermission("settings.pedagogy.manage"),
      async (c) => {
        return c.json(
          {
            settings: await loadPrivacySettings(deps.db),
            defaults: DEFAULT_PRIVACY_SETTINGS,
          },
          200,
        );
      },
    )
    .put(
      "/settings",
      requirePermission("settings.pedagogy.manage"),
      async (c) => {
        const body: unknown = await c.req.json().catch(() => null);
        const parsed = parsePrivacySettings(body);
        if (!parsed.success)
          return fail(c, 422, "invalid_settings", parsed.error.issues);
        const actor = c.get("user").id;
        await deps.db.transaction(async (tx) => {
          await createSettingsStore(tx).set(
            PRIVACY_SETTINGS_KEY,
            parsed.data,
            actor,
          );
          const platform =
            await createOrganizationStore(tx).getPlatformOrganization();
          await createAuditLog(tx).append({
            actorId: actor,
            organizationId: platform?.id ?? null,
            action: "settings.update",
            targetType: "settings",
            targetId: PRIVACY_SETTINGS_KEY,
            details: { ...parsed.data },
          });
        });
        return c.json({ ok: true, settings: parsed.data });
      },
    )
    .get(
      "/organizations/:id/missing-consents",
      zValidator("param", z.object({ id: uuid })),
      async (c) => {
        const organizationId = asOrganizationId(c.req.valid("param").id);
        if (!allowed(c, "members.manage", organizationId))
          return fail(c, 403, "forbidden");
        return c.json(
          {
            learners: await createPrivacyStore(deps.db).learnersWithoutConsent(
              organizationId,
            ),
          },
          200,
        );
      },
    );
}
