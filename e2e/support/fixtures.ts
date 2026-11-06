// Fixtures communes : chaque page ouverte par un scénario est surveillée
// (erreurs de la console, exceptions non rattrapées, réponses 5xx) ; le
// scénario échoue à la fin s'il y en a eu.
import {
  type Browser,
  type BrowserContext,
  test as base,
  expect,
  type Page,
} from "@playwright/test";
import { type AccountName, authFile } from "../accounts";
import { WEB_URL } from "../env";
import { Api } from "./api";

export interface Problems {
  list: string[];
  watch(page: Page): void;
}

type Fixtures = {
  /** Messages de console attendus pour ce scénario (ex. une 404 voulue). */
  allowedConsole: RegExp[];
  problems: Problems;
  /**
   * Ouvre une page connectée avec un compte (démo ou créé par le scénario),
   * ou sans session (`null`) : un second visiteur dans le même scénario.
   */
  pageAs: (
    who: AccountName | { email: string; password: string } | null,
  ) => Promise<Page>;
};

export const test = base.extend<Fixtures>({
  allowedConsole: [[], { option: true }],

  problems: [
    async ({ allowedConsole }, use) => {
      const list: string[] = [];
      const allowed = (text: string) =>
        allowedConsole.some((r) => r.test(text));
      const watch = (page: Page) => {
        page.on("console", (m) => {
          if (m.type() === "error" && !allowed(m.text()))
            list.push(`console (${page.url()}) : ${m.text()}`);
        });
        page.on("pageerror", (e) =>
          list.push(`exception (${page.url()}) : ${e.message}`),
        );
        page.on("response", (r) => {
          if (r.status() >= 500)
            list.push(`${r.status()} ${r.request().method()} ${r.url()}`);
        });
      };
      await use({ list, watch });
      expect(list, "erreurs dans le navigateur ou réponses 5xx").toEqual([]);
    },
    { auto: true },
  ],

  page: async ({ page, problems }, use) => {
    problems.watch(page);
    await use(page);
  },

  pageAs: async (
    {
      browser,
      problems,
      baseURL,
      viewport,
      isMobile,
      hasTouch,
      locale,
      timezoneId,
      colorScheme,
    },
    use,
  ) => {
    const contexts: BrowserContext[] = [];
    // Mêmes réglages que la page par défaut du projet (format mobile compris).
    const options: Parameters<Browser["newContext"]>[0] = {
      viewport,
      isMobile,
      hasTouch,
      colorScheme,
      ...(baseURL ? { baseURL } : {}),
      ...(locale ? { locale } : {}),
      ...(timezoneId ? { timezoneId } : {}),
    };
    await use(async (who) => {
      const context = await newContext(browser, who, options);
      contexts.push(context);
      const page = await context.newPage();
      problems.watch(page);
      return page;
    });
    for (const c of contexts) await c.close();
  },
});

async function newContext(
  browser: Browser,
  who: AccountName | { email: string; password: string } | null,
  options: Parameters<Browser["newContext"]>[0],
): Promise<BrowserContext> {
  if (who === null) return browser.newContext(options);
  if (typeof who === "string")
    return browser.newContext({ ...options, storageState: authFile(who) });
  // Compte créé par le scénario : session ouverte par l'API, puis cookie posé.
  const api = await Api.login(who.email, who.password);
  const state = await api.ctx.storageState();
  await api.dispose();
  const host = new URL(WEB_URL).hostname;
  return browser.newContext({
    ...options,
    storageState: {
      cookies: state.cookies.map((c) => ({ ...c, domain: host })),
      origins: [],
    },
  });
}

export { expect };
