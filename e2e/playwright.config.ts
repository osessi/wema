import { defineConfig, devices } from "@playwright/test";
import { API_URL, APP_PATH, apiEnv, MATH_URL, WEB_PORT, WEB_URL } from "./env";

const CI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./tests",
  // Les scénarios créent chacun leurs données (noms uniques) : ils peuvent
  // tourner en parallèle sur la même base.
  fullyParallel: true,
  workers: CI ? 2 : 4,
  forbidOnly: CI,
  // Pas de nouvel essai : un test fragile doit se voir, pas se cacher.
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: CI
    ? [["list"], ["html", { open: "never" }], ["github"]]
    : [["list"], ["html", { open: "never" }]],
  globalSetup: "./global-setup.ts",
  use: {
    baseURL: WEB_URL,
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
    // En CI, la première visite d'une page la compile (next dev) : plus long.
    navigationTimeout: CI ? 60_000 : 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // Format téléphone : les parcours marqués @mobile.
      name: "mobile",
      grep: /@mobile/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: [
    {
      // services/math (sans état) : celui du développement s'il répond déjà.
      command: "uv run --locked uvicorn wema_math.app:app --port 8000",
      cwd: "../services/math",
      url: `${MATH_URL}/health`,
      reuseExistingServer: true,
      timeout: 120_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      // Base remise à zéro, référentiel importé, puis l'API (voir le script).
      command: "bash scripts/start-api.sh",
      url: `${API_URL}/api/health`,
      env: apiEnv,
      reuseExistingServer: !CI,
      timeout: 180_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: `pnpm --filter @wema/web exec next dev --port ${WEB_PORT}`,
      url: `${WEB_URL}${APP_PATH}/connexion`,
      env: {
        WEMA_API_URL: API_URL,
        WEMA_NEXT_DIST_DIR: ".next-e2e",
        NEXT_TELEMETRY_DISABLED: "1",
      },
      reuseExistingServer: !CI,
      timeout: 240_000,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
