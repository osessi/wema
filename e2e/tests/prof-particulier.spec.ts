import { app } from "../env";
import { unique } from "../support/api";
import { expect, test } from "../support/fixtures";

test.describe("Prof particulier", () => {
  test("inscription, groupe, import de 3 élèves, un élève se connecte avec son code", async ({
    page,
    pageAs,
  }) => {
    // 1. Le prof s'inscrit seul, depuis le lien du site (profil pré-choisi).
    await page.goto(app("/inscription?profil=prof"));
    await expect(
      page.getByRole("radio", { name: /^Prof particulier/ }),
    ).toBeChecked();
    await page.getByLabel("Votre nom").fill("Prof Autonome");
    await page.getByLabel("Adresse e-mail").fill(`${unique("prof")}@wema.test`);
    await page.getByLabel("Mot de passe").fill("mot-de-passe-solide");
    await page.getByLabel("Année de naissance").fill("1982");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Créer mon compte" }).click();

    // 2. Démarrage : bienvenue, puis son groupe.
    await expect(page).toHaveURL(/\/prof\/demarrage/);
    await page.getByRole("button", { name: "Commencer" }).click();
    await expect(page).toHaveURL(/etape=groupe/);
    const group = unique("Groupe");
    await page.getByLabel("Nom de la classe").fill(group);
    await page.getByRole("button", { name: "Créer la classe" }).click();

    // 3. Ses élèves : une liste collée, aperçu, confirmation.
    await expect(page).toHaveURL(/etape=eleves/);
    const last = unique("Mensah").replace(/[^A-Za-z]/g, "");
    await page.getByRole("tab", { name: "Une liste" }).click();
    await page
      .getByLabel("Liste des élèves")
      .fill(`Awa\t${last}\nKofi\t${last}\nAmi\t${last}`);
    await page.getByRole("button", { name: "Vérifier la liste" }).click();
    await expect(page.getByText("3 lignes prêtes")).toBeVisible();
    await page.getByRole("button", { name: "Créer 3 comptes" }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Créer 3 comptes" })
      .click();

    // 4. La fiche des codes : un coupon par élève.
    const coupon = page
      .locator("#code-sheet li")
      .filter({ hasText: `Kofi ${last}` });
    await expect(coupon).toBeVisible();
    await expect(page.locator("#code-sheet li")).toHaveCount(3);
    const username = (await coupon.locator("dd").nth(0).textContent())?.trim();
    const code = (await coupon.locator("dd").nth(1).textContent())?.trim();
    expect(username).toBe(`kofi.${last.toLowerCase()}`);
    expect(code).toMatch(/^\S{6,}$/);

    // 5. L'élève se connecte avec son identifiant et son code, dans le groupe.
    const learner = await pageAs(null);
    await learner.goto(app("/connexion"));
    await learner.getByRole("tab", { name: "Élève" }).click();
    await learner.getByLabel("Identifiant").fill(username ?? "");
    await learner.getByLabel("Code de connexion").fill(code ?? "");
    await learner.getByRole("button", { name: "Se connecter" }).click();
    await expect(learner).toHaveURL(/\/compte\/conditions/);
    await learner
      .getByRole("checkbox", { name: /J'ai lu et j'accepte/ })
      .check();
    await learner
      .getByRole("button", { name: "Accepter et continuer" })
      .click();
    await learner.goto(app("/eleve/progression"));
    await expect(learner.getByRole("heading", { name: group })).toBeVisible();

    // 6. L'accueil du prof montre sa liste de démarrage.
    await page.goto(app("/prof"));
    await expect(
      page.getByRole("heading", { name: "Votre liste de démarrage" }),
    ).toBeVisible();
  });
});
