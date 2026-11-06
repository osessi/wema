import { serve } from "@hono/node-server";
import { type CodeSender, hashPassword, normalizeEmail } from "@wema/access";
import {
  bootstrapPlatform,
  loadPrivacySettings,
  migrate,
  runRetention,
} from "@wema/db";
import { createHttpMathVerifier } from "@wema/exercises";
import { PgBoss } from "pg-boss";
import { createServerAi } from "./ai-setup";
import { createApp } from "./app";
import { billingFromEnv } from "./billing/setup";
import { loadConfig } from "./config";
import { openDatabase } from "./database";
import { runFollowUp } from "./followup";
import { runNotifications } from "./notify/dispatch";
import { createCodeSender, createSenders } from "./notify/setup";
import { appleProvider, googleProvider, type OAuthProviders } from "./oauth";
import { runCollectiveInsights } from "./routes/collective";
import { runWeeklyBank } from "./routes/exercises";
import {
  type ScheduledTask,
  startPgBossScheduler,
  startTimerScheduler,
} from "./scheduler";

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

// Envois (SMS, WhatsApp, e-mail) : prestataires choisis par les variables
// d'environnement ; sans prestataire, la console en développement seulement.
const notify = createSenders(process.env, { production: c.production });
for (const p of notify.problems) console.error(`Envois : ${p}`);
const codeSender: CodeSender = createCodeSender(notify.senders);

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

const math = createHttpMathVerifier(c.WEMA_MATH_URL);

// Paiement : Stripe (carte) et Kkiapay (Mobile Money) si leurs clés sont là ;
// sinon, en développement, un faux fournisseur qui simule un paiement réussi.
const billing = billingFromEnv(process.env, { db, production: c.production });
if (!billing.ok) {
  console.error(`Paiement : ${billing.error}`);
  process.exit(1);
}
console.info(`Paiement : ${billing.value.summary}.`);

const app = createApp({
  db,
  codeSender,
  math,
  ai,
  aiConfigured: Boolean(c.OPENROUTER_API_KEY),
  oauth,
  codeSecret: c.codeSecret,
  healthKey: c.healthKey,
  secureCookies: c.production,
  allowedOrigins: [new URL(c.WEMA_PUBLIC_URL).origin],
  publicUrl: c.WEMA_PUBLIC_URL,
  appUrl: c.appUrl,
  billing: billing.value.deps,
  notifyChannels: (["email", "sms", "whatsapp"] as const).filter(
    (k) => notify.senders[k] !== null,
  ),
  now: () => new Date(),
});

// Suivi actif : un passage peu après le démarrage, puis toutes les heures (un seul
// passage à la fois ; une relance par élève et par jour, garanti par la base).
const followUp = async () => {
  try {
    const result = await runFollowUp(
      db,
      ai,
      new Date(),
      billing.value.deps.access,
    );
    if (result.created > 0 || result.failed > 0) {
      console.info(
        `Suivi : ${result.created} relance(s) préparée(s), ${result.failed} échec(s).`,
      );
    }
  } catch (e) {
    console.error(`Suivi : ${e instanceof Error ? e.name : "erreur"}`);
  }
};

// Banque hebdomadaire : une fois par semaine et par organisation (semaine notée
// dans les réglages), les propositions de l'IA vérifiées par services/math.
const weeklyBank = async () => {
  if (!c.OPENROUTER_API_KEY) return;
  try {
    const result = await runWeeklyBank({ db, ai, math }, new Date());
    if (result.organizations > 0) {
      console.info(
        `Banque ${result.week} : ${result.proposed} proposition(s) pour ${result.organizations} organisation(s).`,
      );
    }
  } catch (e) {
    console.error(`Banque : ${e instanceof Error ? e.name : "erreur"}`);
  }
};
// Avec Postgres, pg-boss (rythmes en base, un seul passage pour tous les
// serveurs) ; sans Postgres (PGlite, développement), minuteries du processus.
const tasks: ScheduledTask[] = [
  {
    name: "suivi-actif",
    cron: "0 * * * *",
    firstRunAfterSeconds: 60,
    everySeconds: 60 * 60,
    run: followUp,
  },
  {
    // Notifications des relances, des messages et des rappels de séance (24 h
    // et 1 h avant), puis envois dus (heures calmes, push Expo, reçus).
    name: "envois",
    cron: "*/5 * * * *",
    firstRunAfterSeconds: 90,
    everySeconds: 5 * 60,
    run: async () => {
      try {
        const r = await runNotifications(
          {
            db,
            senders: notify.senders,
            secret: c.codeSecret,
            publicUrl: c.WEMA_PUBLIC_URL,
            appUrl: c.appUrl,
          },
          new Date(),
        );
        if (r.queued + r.reminders + r.sent + r.failed > 0)
          console.info(
            `Envois : ${r.queued} préparé(s), ${r.reminders} rappel(s) de séance, ${r.sent} envoyé(s), ${r.failed} échec(s).`,
          );
      } catch (e) {
        console.error(`Envois : ${e instanceof Error ? e.name : "erreur"}`);
      }
    },
  },
  {
    // Durées de conservation (fiche 0008) : purges, comptes inactifs,
    // suppressions arrivées à échéance. Des nombres seulement dans les logs.
    name: "conservation",
    cron: "17 3 * * *",
    firstRunAfterSeconds: 3 * 60,
    everySeconds: 24 * 60 * 60,
    run: async () => {
      try {
        const r = await runRetention(
          db,
          await loadPrivacySettings(db),
          new Date(),
        );
        console.info(
          `Conservation : ${r.purged} compte(s) purgé(s), ${r.inactiveScheduled} inactif(s) programmé(s), ${r.sessions + r.oneTimeCodes + r.aiCalls + r.deliveryLogs + r.tutorMessages} ligne(s) effacée(s), ${r.purgeFailed} échec(s).`,
        );
      } catch (e) {
        console.error(
          `Conservation : ${e instanceof Error ? e.name : "erreur"}`,
        );
      }
    },
  },
  {
    name: "banque-hebdomadaire",
    cron: "5 * * * *",
    firstRunAfterSeconds: 2 * 60,
    everySeconds: 60 * 60,
    run: weeklyBank,
  },
  {
    // Apprentissage collectif anonymisé : agrégats par notion, recalculés chaque nuit.
    name: "apprentissage-collectif",
    cron: "40 2 * * *",
    firstRunAfterSeconds: 4 * 60,
    everySeconds: 24 * 60 * 60,
    run: async () => {
      try {
        const r = await runCollectiveInsights(db, new Date());
        console.info(
          `Apprentissage collectif : ${r.notions} notion(s) publiée(s) (seuil ${r.minLearners} élèves).`,
        );
      } catch (e) {
        console.error(
          `Apprentissage collectif : ${e instanceof Error ? e.name : "erreur"}`,
        );
      }
    },
  },
];
const scheduler =
  c.scheduler === "pg-boss" && c.DATABASE_URL
    ? await startPgBossScheduler(
        new PgBoss({
          connectionString: c.DATABASE_URL,
          max: 3,
          application_name: "wema-taches",
        }),
        tasks,
      )
    : startTimerScheduler(tasks);
console.info(`Tâches planifiées : ${scheduler.kind}.`);

const server = serve({ fetch: app.fetch, port: c.PORT }, (info) => {
  console.info(`API Wema sur http://localhost:${info.port}/api`);
});

// Arrêt propre (docker stop, mise à jour) : plus de nouvelles requêtes, les
// requêtes en cours (une réponse en train d'être notée au journal) et les
// tâches finissent, au plus 8 s (docker stop tue au bout de 10 s), puis le
// processus sort.
let stopping = false;
const shutdown = async () => {
  if (stopping) return;
  stopping = true;
  const requestsDone = new Promise<void>((resolve) =>
    server.close(() => resolve()),
  );
  try {
    await Promise.race([
      Promise.all([requestsDone, scheduler.stop()]),
      new Promise((resolve) => setTimeout(resolve, 8000)),
    ]);
  } finally {
    process.exit(0);
  }
};
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
