import { unique } from "../support/api";
import { expect, test } from "../support/fixtures";

test.describe("Back-office", () => {
  test.use({ storageState: "./.auth/admin.json" });

  test("référentiel : créer une notion dans un programme", async ({ page }) => {
    await page.goto("/admin/referentiel");
    await page.getByRole("link", { name: /France/ }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "France (FR)" }),
    ).toBeVisible();
    await page
      .getByRole("row", { name: /^5e Mathématiques/ })
      .getByRole("link", { name: "Ouvrir" })
      .click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Mathématiques · 5e" }),
    ).toBeVisible();

    const code = unique("notion").toLowerCase();
    await page.getByRole("button", { name: "Nouvelle notion" }).first().click();
    await page.getByLabel("Code", { exact: true }).fill(code);
    await page.getByLabel("Nom de la notion").fill("Notion e2e");
    await page
      .getByLabel("Ce que l'élève doit savoir faire")
      .fill("Savoir faire un test de bout en bout.");
    await page.getByRole("button", { name: "Créer", exact: true }).click();
    await expect(
      page.getByRole("button", { name: new RegExp(code) }),
    ).toBeVisible();
    // Toujours là après rechargement : elle est en base.
    await page.reload();
    await expect(
      page.getByRole("button", { name: new RegExp(code) }),
    ).toBeVisible();
  });

  test("réglages pédagogiques : modifier, enregistrer, revenir", async ({
    page,
  }) => {
    await page.goto("/admin/reglages");
    const delay = page.getByLabel("Délai de reconfirmation (heures)");
    await expect(delay).toHaveValue("72");
    await delay.fill("96");
    const save = page.getByRole("button", { name: "Enregistrer" }).first();
    await save.click();
    await page.reload();
    await expect(delay).toHaveValue("96");
    // On remet la valeur d'origine : les autres scénarios calculent avec.
    await delay.fill("72");
    await save.click();
    await page.reload();
    await expect(delay).toHaveValue("72");
  });
});
