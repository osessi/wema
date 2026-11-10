import { app } from "../env";
import { unique } from "../support/api";
import { expect, test } from "../support/fixtures";

test.describe("École", () => {
  test("créer une classe, ajouter un élève par identifiant, l'inscrire, il se connecte", async ({
    pageAs,
    page,
  }) => {
    const direction = await pageAs("direction");
    await direction.goto(app("/ecole"));
    await expect(
      direction.getByRole("heading", { level: 1, name: "Collège démo" }),
    ).toBeVisible();
    const base = direction.url();

    // Classe neuve.
    const className = unique("Classe école");
    await direction.goto(`${base}/classes`);
    await direction.getByLabel("Nom de la classe").fill(className);
    await direction.getByRole("button", { name: "Créer la classe" }).click();
    // La classe créée s'ouvre.
    await expect(
      direction.getByRole("heading", { level: 1, name: className }),
    ).toBeVisible();
    const classUrl = direction.url();

    // Élève sans e-mail : identifiant, et code affiché une seule fois.
    const learnerName = unique("Élève Code");
    const username = unique("code").toLowerCase();
    await direction.goto(`${base}/membres`);
    await direction.getByRole("tab", { name: "Identifiant élève" }).click();
    await direction.getByLabel("Nom affiché").fill(learnerName);
    await direction
      .getByRole("textbox", { name: "Identifiant" })
      .fill(username);
    await direction.getByRole("button", { name: "Ajouter le membre" }).click();
    const shown = direction
      .getByRole("alert")
      .filter({ hasText: `Code de connexion` });
    await expect(shown).toContainText(username);
    const code = (await shown.locator("strong").nth(1).textContent())?.trim();
    expect(code).toMatch(/^\S{6,}$/);

    // Inscription dans la classe.
    await direction.goto(classUrl);
    await direction.getByRole("combobox", { name: "Membre" }).click();
    await direction.getByRole("option", { name: learnerName }).click();
    await direction.getByRole("button", { name: "Inscrire" }).click();
    await expect(
      direction.getByRole("listitem").filter({ hasText: learnerName }),
    ).toBeVisible();

    // L'élève se connecte avec son identifiant et son code.
    await page.goto(app("/connexion"));
    await page.getByRole("tab", { name: "Élève" }).click();
    await page.getByLabel("Identifiant").fill(username);
    await page.getByLabel("Code de connexion").fill(code ?? "");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL(/\/compte\/conditions/);
    await page.getByRole("checkbox", { name: /J'ai lu et j'accepte/ }).check();
    await page.getByRole("button", { name: "Accepter et continuer" }).click();
    await page.goto(app("/eleve/progression"));
    await expect(page.getByRole("heading", { name: className })).toBeVisible();
  });
});
