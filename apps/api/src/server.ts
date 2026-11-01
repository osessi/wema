import { serve } from "@hono/node-server";
import { type CodeSender, hashPassword, normalizeEmail } from "@wema/access";
import { bootstrapPlatform, migrate } from "@wema/db";
import { ok } from "@wema/domain";
import { createApp } from "./app";
import { loadConfig } from "./config";
import { openDatabase } from "./database";
import { appleProvider, googleProvider, type OAuthProviders } from "./oauth";

const config = loadConfig(process.env);
if (!config.ok) {
  console.error(config.error.message);
  process.exit(1);
}
const c = config.value;

const db = await openDatabase(c);
await migrate(db);

const email = c.WEMA_SUPER_ADMIN_EMAIL
  ? normalizeEmail(c.WEMA_SUPER_ADMIN_EMAIL)
  : null;
const boot = await bootstrapPlatform(db, {
  superAdmin:
    email?.ok && c.WEMA_SUPER_ADMIN_PASSWORD
      ? {
          displayName: c.WEMA_SUPER_ADMIN_NAME,
          email: email.value,
          passwordHash: await hashPassword(c.WEMA_SUPER_ADMIN_PASSWORD),
        }
      : null,
});
if (boot.createdSuperAdmin) console.info("Premier super admin créé.");

// Tant qu'aucun prestataire SMS / WhatsApp n'est branché, les codes sont
// affichés dans la console du serveur, en développement seulement.
const codeSender: CodeSender = {
  async send(message) {
    if (c.production)
      return {
        ok: false,
        error: { kind: "send_failed", reason: "aucun prestataire configuré" },
      };
    console.info(
      `[dev] code ${message.channel} pour …${message.to.slice(-2)} : ${message.code}`,
    );
    return ok(undefined);
  },
};

const oauth: OAuthProviders = {};
if (c.GOOGLE_CLIENT_ID && c.GOOGLE_CLIENT_SECRET) {
  oauth.google = googleProvider({
    clientId: c.GOOGLE_CLIENT_ID,
    clientSecret: c.GOOGLE_CLIENT_SECRET,
    redirectUri: `${c.WEMA_PUBLIC_URL}/api/auth/oauth/google/callback`,
  });
}
if (
  c.APPLE_CLIENT_ID &&
  c.APPLE_TEAM_ID &&
  c.APPLE_KEY_ID &&
  c.APPLE_PRIVATE_KEY
) {
  oauth.apple = appleProvider({
    clientId: c.APPLE_CLIENT_ID,
    teamId: c.APPLE_TEAM_ID,
    keyId: c.APPLE_KEY_ID,
    privateKey: c.APPLE_PRIVATE_KEY,
    redirectUri: `${c.WEMA_PUBLIC_URL}/api/auth/oauth/apple/callback`,
  });
}

const app = createApp({
  db,
  codeSender,
  oauth,
  codeSecret: c.codeSecret,
  secureCookies: c.production,
  allowedOrigins: [new URL(c.WEMA_PUBLIC_URL).origin],
  publicUrl: c.WEMA_PUBLIC_URL,
  now: () => new Date(),
});

serve({ fetch: app.fetch, port: c.PORT }, (info) => {
  console.info(`API Wema sur http://localhost:${info.port}/api`);
});
