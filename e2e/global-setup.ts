// Prépare les données communes, une fois avant tous les scénarios (l'API et le
// web sont déjà démarrés par webServer) : jeu de démonstration, conditions
// acceptées, et une session enregistrée par compte (e2e/.auth/<compte>.json).
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { request } from "@playwright/test";
import { ACCOUNT_NAMES, ACCOUNTS, authFile } from "./accounts";
import { ADMIN, API_PORT, WEB_URL } from "./env";

export default async function globalSetup() {
  // Idempotent : ne recrée pas ce qui existe (utile quand les serveurs sont
  // réutilisés en local).
  execFileSync("pnpm", ["exec", "tsx", "src/seed-demo.ts"], {
    cwd: fileURLToPath(new URL("../apps/api", import.meta.url)),
    env: {
      ...process.env,
      PORT: String(API_PORT),
      WEMA_PUBLIC_URL: WEB_URL,
      WEMA_SUPER_ADMIN_EMAIL: ADMIN.email,
      WEMA_SUPER_ADMIN_PASSWORD: ADMIN.password,
    },
    stdio: "inherit",
  });

  mkdirSync(fileURLToPath(new URL("./.auth", import.meta.url)), {
    recursive: true,
  });
  const anonymous = await request.newContext({ baseURL: WEB_URL });
  const versions = await (await anonymous.get("/api/legal/versions")).json();
  await anonymous.dispose();

  for (const name of ACCOUNT_NAMES) {
    const account = ACCOUNTS[name];
    const ctx = await request.newContext({
      baseURL: WEB_URL,
      extraHTTPHeaders: { origin: WEB_URL },
    });
    const login = await ctx.post("/api/auth/login", {
      data: { email: account.email, password: account.password },
    });
    if (!login.ok())
      throw new Error(`Connexion de ${name} impossible : ${login.status()}`);
    const terms = await ctx.post("/api/account/terms", {
      data: {
        termsVersion: versions.termsVersion,
        privacyVersion: versions.privacyVersion,
      },
    });
    if (!terms.ok())
      throw new Error(`Conditions de ${name} : ${terms.status()}`);
    await ctx.storageState({ path: authFile(name) });
    await ctx.dispose();
  }
}
