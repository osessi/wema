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
  SESSION_TTL_MS,
  verifyOneTimeCode,
  verifyPassword,
} from "@wema/access";
import {
  createAccountStore,
  createOrganizationStore,
  type User,
} from "@wema/db";
import type { UserId } from "@wema/domain";
import { type Context, Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import type { Deps, Env } from "../context";
import { fail, requireSession, SESSION_COOKIE } from "../http";
import type { OAuthProfile, OAuthProviderName } from "../oauth";

// Empreinte d'un mot de passe jamais attribué : vérifiée quand le compte
// n'existe pas, pour que la réponse prenne le même temps (pas d'indice sur
// l'existence d'un compte).
const DUMMY_HASH = hashPassword("compte-inexistant-wema");

/** Codes envoyés au même numéro par heure, au plus. */
const CODES_PER_HOUR = 5;

const OAUTH_COOKIE = "wema_oauth";

async function openSession(c: Context, deps: Deps, userId: UserId) {
  const { token, tokenHash } = createSessionToken();
  await createAccountStore(deps.db).createSession({
    tokenHash,
    userId,
    expiresAt: new Date(deps.now().getTime() + SESSION_TTL_MS),
  });
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: deps.secureCookies,
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
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
    const byEmail =
      profile.email && profile.emailVerified
        ? await accounts.findIdentity("email", profile.email)
        : null;
    const userId =
      byEmail?.userId ??
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
        }),
      ),
      async (c) => {
        const body = c.req.valid("json");
        const email = normalizeEmail(body.email);
        if (!email.ok) return fail(c, 422, email.error.kind);
        const rules = checkPasswordRules(body.password);
        if (!rules.ok) return fail(c, 422, rules.error.kind);
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
          return user.id;
        });
        if (!userId) return fail(c, 409, "email_taken");
        await openSession(c, deps, userId);
        return c.json({ ok: true }, 201);
      },
    )
    .post(
      "/login",
      zValidator("json", z.object({ email: z.string(), password: z.string() })),
      async (c) => {
        const body = c.req.valid("json");
        const email = normalizeEmail(body.email);
        const identity = email.ok
          ? await accounts.findIdentity("email", email.value)
          : null;
        const valid = await verifyPassword(
          body.password,
          identity?.secretHash ?? (await DUMMY_HASH),
        );
        if (!identity || !valid) return fail(c, 401, "invalid_credentials");
        const user = await accounts.getUser(identity.userId);
        if (!user || user.disabled) return fail(c, 401, "invalid_credentials");
        await openSession(c, deps, user.id);
        return c.json({ ok: true });
      },
    )
    .post(
      "/learner",
      zValidator("json", z.object({ username: z.string(), code: z.string() })),
      async (c) => {
        const body = c.req.valid("json");
        const username = normalizeUsername(body.username);
        const identity = username.ok
          ? await accounts.findIdentity("username", username.value)
          : null;
        const valid = await verifyPassword(
          body.code.trim().toLowerCase(),
          identity?.secretHash ?? (await DUMMY_HASH),
        );
        if (!identity || !valid) return fail(c, 401, "invalid_credentials");
        const user = await accounts.getUser(identity.userId);
        if (!user || user.disabled) return fail(c, 401, "invalid_credentials");
        await openSession(c, deps, user.id);
        return c.json({ ok: true });
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
        await accounts.consumeCode(stored.id, now);
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
        await openSession(c, deps, userId);
        return c.json({ ok: true });
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
          organizations: orgs.filter((o) => o !== null),
          /** Permissions effectives hors organisation précise (plateforme). */
          permissions: effectivePermissions(memberships),
        },
        200,
      );
    });
}
