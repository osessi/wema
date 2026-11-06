import { app } from "../env";
import { expect, test } from "../support/fixtures";

test.describe("Page introuvable", () => {
  // Le navigateur signale la réponse 404 de la page dans la console.
  test.use({ allowedConsole: [/status of 404/] });

  test("une adresse inconnue affiche la page 404 @mobile", async ({ page }) => {
    const res = await page.goto(app("/cette-page-nexiste-pas"));
    expect(res?.status()).toBe(404);
    await expect(page.getByText("404")).toBeVisible();
    await page.getByRole("link").filter({ hasText: /./ }).first().click();
    await expect(page).not.toHaveURL(/cette-page-nexiste-pas/);
  });

  // Une adresse tapée à la main (élément inconnu, identifiant mal formé) donne
  // la page 404, jamais la page d'erreur (bug corrigé : c'était une 500).
  for (const [who, path] of [
    ["admin", "/admin/referentiel/00000000-0000-4000-8000-000000000000"],
    ["admin", "/admin/referentiel/pas-un-identifiant"],
    ["prof", "/prof/classes/pas-un-identifiant"],
    ["prof", "/prof/classes/00000000-0000-4000-8000-000000000000"],
    ["parent", "/parent/agenda/seances/00000000-0000-4000-8000-000000000000"],
  ] as const)
    test(`${who} : ${path} donne la page 404`, async ({ pageAs }) => {
      const page = await pageAs(who);
      const res = await page.goto(app(path));
      expect(res?.status()).toBe(404);
      await expect(
        page.getByRole("heading", { level: 1, name: "Page introuvable" }),
      ).toBeVisible();
    });
});

test.describe("Thème sombre", () => {
  test("basculer en sombre et parcourir les espaces sans erreur", async ({
    pageAs,
  }) => {
    const prof = await pageAs("prof");
    await prof.goto(app("/prof"));
    await prof.getByRole("button", { name: "Mon compte" }).click();
    await prof.getByRole("menuitem", { name: /sombre/i }).click();
    await expect(prof.locator("html")).toHaveClass(/dark/);
    for (const path of ["/prof/banque", "/prof/exercices", "/prof/agenda"]) {
      await prof.goto(app(path));
      await expect(prof.locator("html")).toHaveClass(/dark/);
      await expect(prof.getByRole("heading", { level: 1 })).toBeVisible();
    }
  });

  test.describe("préférence sombre du système", () => {
    test.use({ colorScheme: "dark" });
    for (const [who, paths] of [
      [
        "eleve2",
        ["/eleve", "/eleve/exercices", "/eleve/progression", "/eleve/messages"],
      ],
      ["parent", ["/parent", "/parent/abonnements", "/parent/agenda"]],
      ["direction", ["/ecole"]],
      ["admin", ["/admin", "/admin/referentiel", "/admin/offres"]],
    ] as const)
      test(`espace de ${who} en sombre @mobile`, async ({ pageAs }) => {
        const page = await pageAs(who);
        for (const path of paths) {
          await page.goto(app(path));
          await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        }
      });
  });
});

test.describe("Navigation au téléphone", () => {
  test("le menu s'ouvre et mène à une autre page @mobile", async ({
    pageAs,
    isMobile,
  }) => {
    test.skip(!isMobile, "menu latéral replié seulement au format téléphone");
    const page = await pageAs("eleve2");
    await page.goto(app("/eleve"));
    await page
      .getByRole("button", { name: "Afficher ou masquer le menu" })
      .click();
    await page.getByRole("link", { name: "Ma progression" }).click();
    await expect(page).toHaveURL(/\/eleve\/progression$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Mon chemin" }),
    ).toBeVisible();
  });
});
