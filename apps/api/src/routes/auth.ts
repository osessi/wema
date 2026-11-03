import { zValidator } from "@hono/zod-validator";
import {
  checkPasswordRules,
  createOneTimeCode,
  createSessionToken,
  effectivePermissions,
  hashPassword,
  normalizeEmail,
  normalizePhone,
  normalizeUsername,
  passwordWorkSaturated,
  SESSION_TTL_MS,
  verifyOneTimeCode,
  verifyPassword,
} from "@wema/access";
import {
  createAccountStore,
  createOrganizationStore,
  createPrivacyStore,
  loadPrivacySettings,
  type User,
} from "@wema/db";
import type { UserId } from "@wema/domain";
import { type Context, Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import type { Deps, Env } from "../context";
import {
  CLIENT_HEADER,
  fail,
  MOBILE_CLIENT,
  requireSession,
  SESSION_COOKIE,
} from "../http";
import type { OAuthProfile, OAuthProviderName } from "../oauth";
import { createFailureLimiter } from "../rate-limit";
import { mustAcceptTerms } from "./account";

// Empreinte d'un mot de passe jamais attribué : vérifiée quand le compte
// n'existe pas, pour que la réponse prenne le même temps (pas d'indice sur
// l'existence d'un compte).
const DUMMY_HASH = hashPassword("compte-inexistant-wema");

/**
 * Rafale de connexions : la file des calculs de mot de passe est pleine. On
 * répond tout de suite « réessayez dans 2 s » plutôt que de faire attendre
 * le client plus longtemps qu'il ne patiente (docs/tests-charge-2026-11.md).
 */
function serverBusy(c: Context) {
  c.header("Retry-After", "2");
  return fail(c, 503, "server_busy");
}

/** Codes envoyés au même numéro par heure, au plus. */
const CODES_PER_HOUR = 5;

const OAUTH_COOKIE = "wema_oauth";

/**
 * Ouvre une session. Le navigateur la reçoit en cookie `HttpOnly` ; l'appli
 * mobile (en-tête `x-wema-client: mobile`) reçoit le jeton dans la réponse,
 * pour le garder dans le coffre du téléphone (pas de cookie dans ce cas).
 */
async function openSession(
  c: Context,
  deps: Deps,
  userId: UserId,
): Promise<{ token?: string }> {
  const { token, tokenHash } = createSessionToken();
  await createAccountStore(deps.db).createSession({
    tokenHash,
    userId,
    expiresAt: new Date(deps.now().getTime() + SESSION_TTL_MS),
  });
  if (c.req.header(CLIENT_HEADER) === MOBILE_CLIENT) return { token };
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: deps.secureCookies,
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
  return {};
}

const sessionUser = (user: User) => ({
  id: user.id,
  displayName: user.displayName,
});

/**
 * Compte associé à une connexion Google ou Apple : l'identité déjà connue, ou
 * le compte qui a déjà cet e-mail si le fournisseur l'a vérifié, ou un compte
 * neuf.
 */
async function userForOAuth(
  deps: Deps,
  provider: OAuthProviderName,
  profile: OAuthProfile,
): Promise<UserId> {
  return deps.db.transaction(async (tx) => {
    const accounts = createAccountStore(tx);
    const known = await accounts.findIdentity(provider, profile.subject);
    if (known) return known.userId;
    // On ne rattache qu'à une adresse déjà vérifiée chez nous : sinon, quelqu'un
    // qui s'inscrirait avec l'e-mail d'une autre personne récupérerait son compte
    // Google ou Apple.
    const byEmail =
      profile.email && profile.emailVerified
        ? await accounts.findIdentity("email", profile.email)
        : null;
    const userId =
      (byEmail?.verified ? byEmail.userId : undefined) ??
      (
        await accounts.createUser({
          displayName: profile.name ?? profile.email ?? "Nouveau compte",
          createdBy: null,
        })
      ).id;
    await accounts.addIdentity({
      userId,
      kind: provider,
      identifier: profile.subject,
      secretHash: null,
      verified: true,
    });
    return userId;
  });
}

export function authRoutes(deps: Deps) {
  const accounts = createAccountStore(deps.db);
  // 10 échecs en 15 minutes bloquent la clé (e-mail ou identifiant élève).
  const failures = createFailureLimiter({
    max: 10,
    windowMs: 15 * 60 * 1000,
    now: deps.now,
  });

  const finishOAuth = async (
    c: Context,
    provider: OAuthProviderName,
    code: string | undefined,
    state: string | undefined,
  ) => {
    const oauth = deps.oauth[provider];
    const saved = getCookie(c, OAUTH_COOKIE);
    deleteCookie(c, OAUTH_COOKIE, { path: "/" });
    const [savedProvider, savedState, verifier] = saved?.split(":") ?? [];
    const failed = c.redirect(`${deps.publicUrl}/connexion?erreur=oauth`);
    if (
      !oauth ||
      !code ||
      !state ||
      savedProvider !== provider ||
      savedState !== state
    )
      return failed;
    const profile = await oauth.finish(code, verifier || null);
    if (!profile.ok) return failed;
    await openSession(
      c,
      deps,
      await userForOAuth(deps, provider, profile.value),
    );
    return c.redirect(`${deps.publicUrl}/admin`);
  };

  return new Hono<Env>()
    .post(
      "/register",
      zValidator(
        "json",
        z.object({
          displayName: z.string().trim().min(1).max(120),
          email: z.string(),
          password: z.string(),
          /** Année de naissance déclarée (non conservée) : consentement parental (fiche 0008). */
          birthYear: z.number().int().min(1900).max(2100).optional(),
          /** Conditions et politique de confidentialité en vigueur, cochées à l'inscription. */
          acceptTerms: z.literal(true).optional(),
        }),
      ),
      async (c) => {
        const body = c.req.valid("json");
        const privacySettings = await loadPrivacySettings(deps.db);
        // En dessous de l'âge du consentement numérique, c'est le parent qui
        // crée le compte (et donne son consentement) depuis son espace famille.
        // Âge au plus juste : l'anniversaire de l'année n'est peut-être pas passé.
        if (
          body.birthYear !== undefined &&
          deps.now().getUTCFullYear() - body.birthYear - 1 <
            privacySettings.digitalConsentAge
        )
          return fail(c, 422, "minor_needs_guardian");
        const email = normalizeEmail(body.email);
        if (!email.ok) return fail(c, 422, email.error.kind);
        const rules = checkPasswordRules(body.password);
        if (!rules.ok) return fail(c, 422, rules.error.kind);
        if (passwordWorkSaturated()) return serverBusy(c);
        const passwordHash = await hashPassword(body.password);
        const userId = await deps.db.transaction(async (tx) => {
          const store = createAccountStore(tx);
          if (await store.findIdentity("email", email.value)) return null;
          const user = await store.createUser({
            displayName: body.displayName,
            createdBy: null,
          });
          await store.addIdentity({
            userId: user.id,
            kind: "email",
            identifier: email.value,
            secretHash: passwordHash,
            verified: false,
          });
          if (body.acceptTerms)
            await createPrivacyStore(tx).acceptTerms({
              userId: user.id,
              termsVersion: privacySettings.termsVersion,
              privacyVersion: privacySettings.privacyVersion,
            });
          return user.id;
        });
        if (!userId) return fail(c, 409, "email_taken");
        const session = await openSession(c, deps, userId);
        return c.json({ ok: true, ...session }, 201);
      },
    )
    .post(
      "/login",
      zValidator("json", z.object({ email: z.string(), password: z.string() })),
      async (c) => {
        const body = c.req.valid("json");
        const email = normalizeEmail(body.email);
        const key = `email:${email.ok ? email.value : body.email}`;
        if (failures.blocked(key)) return fail(c, 429, "too_many_attempts");
        if (passwordWorkSaturated()) return serverBusy(c);
        const identity = email.ok
          ? await accounts.findIdentity("email", email.value)
          : null;
        const valid = await verifyPassword(
          body.password,
          identity?.secretHash ?? (await DUMMY_HASH),
        );
        if (!identity || !valid) {
          failures.fail(key);
          return fail(c, 401, "invalid_credentials");
        }
        failures.reset(key);
        const user = await accounts.getUser(identity.userId);
        if (!user || user.disabled) return fail(c, 401, "invalid_credentials");
        const session = await openSession(c, deps, user.id);
        return c.json({ ok: true, ...session });
      },
    )
    .post(
      "/learner",
      zValidator("json", z.object({ username: z.string(), code: z.string() })),
      async (c) => {
        const body = c.req.valid("json");
        const username = normalizeUsername(body.username);
        const key = `username:${username.ok ? username.value : body.username}`;
        if (failures.blocked(key)) return fail(c, 429, "too_many_attempts");
        if (passwordWorkSaturated()) return serverBusy(c);
        const identity = username.ok
          ? await accounts.findIdentity("username", username.value)
          : null;
        const valid = await verifyPassword(
          body.code.trim().toLowerCase(),
          identity?.secretHash ?? (await DUMMY_HASH),
        );
        if (!identity || !valid) {
          failures.fail(key);
          return fail(c, 401, "invalid_credentials");
        }
        failures.reset(key);
        const user = await accounts.getUser(identity.userId);
        if (!user || user.disabled) return fail(c, 401, "invalid_credentials");
        const session = await openSession(c, deps, user.id);
        return c.json({ ok: true, ...session });
      },
    )
    .post(
      "/phone/request",
      zValidator(
        "json",
        z.object({ phone: z.string(), channel: z.enum(["sms", "whatsapp"]) }),
      ),
      async (c) => {
        const body = c.req.valid("json");
        const phone = normalizePhone(body.phone);
        if (!phone.ok) return fail(c, 422, phone.error.kind);
        const now = deps.now();
        const recent = await accounts.countCodesSince(
          phone.value,
          new Date(now.getTime() - 60 * 60 * 1000),
        );
        if (recent >= CODES_PER_HOUR) return fail(c, 429, "too_many_codes");
        const issued = createOneTimeCode(deps.codeSecret, now);
        await accounts.createOneTimeCode({
          phone: phone.value,
          codeHash: issued.codeHash,
          expiresAt: issued.expiresAt,
        });
        const sent = await deps.codeSender.send({
          channel: body.channel,
          to: phone.value,
          code: issued.code,
        });
        if (!sent.ok) return fail(c, 502, "send_failed");
        return c.json({ ok: true });
      },
    )
    .post(
      "/phone/verify",
      zValidator(
        "json",
        z.object({
          phone: z.string(),
          code: z.string(),
          displayName: z.string().trim().min(1).max(120).optional(),
        }),
      ),
      async (c) => {
        const body = c.req.valid("json");
        const phone = normalizePhone(body.phone);
        if (!phone.ok) return fail(c, 422, phone.error.kind);
        const now = deps.now();
        const stored = await accounts.attemptLatestCode(phone.value);
        if (!stored) return fail(c, 401, "code_mismatch");
        const checked = verifyOneTimeCode(
          deps.codeSecret,
          stored,
          body.code,
          now,
        );
        if (!checked.ok) return fail(c, 401, checked.error.kind);
        if (!(await accounts.consumeCode(stored.id, now))) {
          return fail(c, 401, "code_used");
        }
        const userId = await deps.db.transaction(async (tx) => {
          const store = createAccountStore(tx);
          const known = await store.findIdentity("phone", phone.value);
          if (known) return known.userId;
          const user = await store.createUser({
            displayName: body.displayName ?? "Nouveau compte",
            createdBy: null,
          });
          await store.addIdentity({
            userId: user.id,
            kind: "phone",
            identifier: phone.value,
            secretHash: null,
            verified: true,
          });
          return user.id;
        });
        const user = await accounts.getUser(userId);
        if (!user || user.disabled) return fail(c, 401, "invalid_credentials");
        const session = await openSession(c, deps, userId);
        return c.json({ ok: true, ...session });
      },
    )
    .get("/providers", (c) =>
      c.json(
        {
          google: deps.oauth.google !== undefined,
          apple: deps.oauth.apple !== undefined,
        },
        200,
      ),
    )
    .get("/oauth/:provider/start", (c) => {
      const provider = c.req.param("provider");
      if (provider !== "google" && provider !== "apple")
        return fail(c, 404, "not_found");
      const oauth = deps.oauth[provider];
      if (!oauth) return fail(c, 404, "provider_disabled");
      const { url, state, codeVerifier } = oauth.start();
      setCookie(c, OAUTH_COOKIE, `${provider}:${state}:${codeVerifier ?? ""}`, {
        httpOnly: true,
        secure: deps.secureCookies,
        // Apple revient en POST depuis son domaine : il faut SameSite=None (donc HTTPS).
        sameSite: deps.secureCookies ? "None" : "Lax",
        path: "/",
        maxAge: 10 * 60,
      });
      return c.redirect(url.toString());
    })
    .get("/oauth/google/callback", (c) =>
      finishOAuth(c, "google", c.req.query("code"), c.req.query("state")),
    )
    .post("/oauth/apple/callback", async (c) => {
      const form = await c.req.parseBody();
      const code = typeof form.code === "string" ? form.code : undefined;
      const state = typeof form.state === "string" ? form.state : undefined;
      return finishOAuth(c, "apple", code, state);
    })
    .post("/logout", requireSession(deps), async (c) => {
      await accounts.deleteSession(c.get("sessionTokenHash"));
      deleteCookie(c, SESSION_COOKIE, { path: "/" });
      return c.json({ ok: true });
    })
    .get("/me", requireSession(deps), async (c) => {
      const memberships = c.get("memberships");
      const organizations = createOrganizationStore(deps.db);
      const byOrg = new Map<string, { roleIds: string[] }>();
      for (const m of memberships)
        byOrg.set(m.organizationId, {
          roleIds: [...(byOrg.get(m.organizationId)?.roleIds ?? []), m.roleId],
        });
      const orgs = await Promise.all(
        [...byOrg.keys()].map(async (id) => {
          const org = memberships.find((m) => m.organizationId === id);
          const detail = org
            ? await organizations.getOrganization(org.organizationId)
            : null;
          return detail
            ? {
                id: detail.id,
                name: detail.name,
                kind: detail.kind,
                permissions: effectivePermissions(memberships, detail.id),
              }
            : null;
        }),
      );
      return c.json(
        {
          user: sessionUser(c.get("user")),
          /** Conditions en vigueur pas encore acceptées : l'interface les présente (fiche 0008). */
          mustAcceptTerms: await mustAcceptTerms(deps.db, c.get("user").id),
          organizations: orgs.filter((o) => o !== null),
          /** Permissions effectives au niveau de la plateforme (rôles dans Wema). */
          permissions: effectivePermissions(
            memberships.filter((m) => m.organizationKind === "platform"),
          ),
        },
        200,
      );
    });
}
