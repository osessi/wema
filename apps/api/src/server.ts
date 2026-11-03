import { serve } from "@hono/node-server";
import { type CodeSender, hashPassword, normalizeEmail } from "@wema/access";
import { bootstrapPlatform, migrate } from "@wema/db";
import { ok } from "@wema/domain";
import { createHttpMathVerifier } from "@wema/exercises";
import { createServerAi } from "./ai-setup";
import { createApp } from "./app";
import { loadConfig } from "./config";
import { openDatabase } from "./database";
import { runFollowUp } from "./followup";
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
if (boot.superAdminEmailTaken) {
  console.error(
    "WEMA_SUPER_ADMIN_EMAIL appartient déjà à un compte : il n'a pas été promu super admin. Choisissez une autre adresse.",
  );
}

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

const ai = createServerAi(db, {
  openRouterKey: c.OPENROUTER_API_KEY ?? null,
  appUrl: c.WEMA_PUBLIC_URL,
});

const app = createApp({
  db,
  codeSender,
  math: createHttpMathVerifier(c.WEMA_MATH_URL),
  ai,
  aiConfigured: Boolean(c.OPENROUTER_API_KEY),
  oauth,
  codeSecret: c.codeSecret,
  healthKey: c.healthKey,
  secureCookies: c.production,
  allowedOrigins: [new URL(c.WEMA_PUBLIC_URL).origin],
  publicUrl: c.WEMA_PUBLIC_URL,
  now: () => new Date(),
});

// Suivi actif : un passage peu après le démarrage, puis toutes les heures (un seul
// passage à la fois ; une relance par élève et par jour, garanti par la base).
// pg-boss le remplacera quand il y aura plusieurs serveurs.
const followUp = async () => {
  try {
    const result = await runFollowUp(db, ai, new Date());
    if (result.created > 0 || result.failed > 0) {
      console.info(
        `Suivi : ${result.created} relance(s) préparée(s), ${result.failed} échec(s).`,
      );
    }
  } catch (e) {
    console.error(`Suivi : ${e instanceof Error ? e.name : "erreur"}`);
  }
};
setTimeout(followUp, 60 * 1000).unref();
setInterval(followUp, 60 * 60 * 1000).unref();

serve({ fetch: app.fetch, port: c.PORT }, (info) => {
  console.info(`API Wema sur http://localhost:${info.port}/api`);
});
