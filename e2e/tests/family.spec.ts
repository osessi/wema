import { Api, ensureOffer, unique } from "../support/api";
import { expect, test } from "../support/fixtures";

test.describe("Famille autonome", () => {
  test("inscription du parent, famille, enfant en 4e, essai gratuit, l'enfant se connecte et voit un exercice @mobile", async ({
    page,
    pageAs,
  }) => {
    // Une offre de maths en France, avec essai gratuit (créée si besoin).
    const admin = await Api.admin();
    await ensureOffer(admin);
    await admin.dispose();

    // 1. Le parent s'inscrit seul.
    await page.goto("/inscription");
    await page.getByRole("radio", { name: /^Parent/ }).check();
    await page.getByLabel("Votre nom").fill("Parent Autonome");
    await page
      .getByLabel("Adresse e-mail")
      .fill(`${unique("famille")}@wema.test`);
    await page.getByLabel("Mot de passe").fill("mot-de-passe-solide");
    await page.getByLabel("Année de naissance").fill("1984");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Créer mon compte" }).click();

    // 2. Il crée sa famille.
    await expect(page).toHaveURL(/\/famille\/creer$/);
    const familyName = unique("Famille");
    await page.getByLabel("Nom de la famille").fill(familyName);
    await page.getByRole("button", { name: "Créer ma famille" }).click();
    await expect(page).toHaveURL(/\/parent\/famille$/);

    // 3. Il ajoute son enfant : identifiant et code, France, 4e, maths.
    const username = unique("enfant").toLowerCase();
    await page.getByLabel("Prénom").fill("Kofi");
    await page.getByLabel("Identifiant", { exact: true }).fill(username);
    await page.getByLabel("Pays").selectOption({ label: "France" });
    await page.getByLabel("Classe", { exact: true }).selectOption({
      label: "4e",
    });
    await page.getByRole("checkbox", { name: "Mathématiques" }).check();
    await page.getByRole("checkbox", { name: /Je suis le parent/ }).check();
    await page.getByRole("button", { name: "Ajouter cet enfant" }).click();
    const code = page
      .getByRole("alert")
      .filter({ hasText: "Code de connexion de Kofi" });
    await expect(code).toBeVisible();
    const loginCode = (
      await code.getByText("Code :").locator("strong").textContent()
    )?.trim();
    expect(loginCode, "code de connexion affiché").toBeTruthy();

    // 4. Essai gratuit des maths pour l'enfant.
    await page.goto("/parent/abonnements");
    await page.getByRole("button", { name: /Essayer gratuitement/ }).click();
    await expect(page.getByText(/Essai jusqu'au/).first()).toBeVisible();

    // 5. L'enfant se connecte avec son code, accepte les conditions.
    const child = await pageAs(null);
    await child.goto("/connexion");
    await child.getByRole("tab", { name: "Élève" }).click();
    await child.getByLabel("Identifiant").fill(username);
    await child.getByLabel("Code de connexion").fill(loginCode ?? "");
    await child.getByRole("button", { name: "Se connecter" }).click();
    await expect(child).toHaveURL(/\/compte\/conditions/);
    await child.getByRole("checkbox", { name: /J'ai lu et j'accepte/ }).check();
    await child.getByRole("button", { name: "Accepter et continuer" }).click();
    await expect(child).toHaveURL(/\/eleve$/);

    // 6. Son programme individuel lui propose un exercice de 4e.
    await child.goto("/eleve/exercices");
    await child.getByRole("link", { name: "Faire l'exercice" }).first().click();
    await expect(
      child.getByRole("button", { name: "Vérifier ma réponse" }),
    ).toBeVisible();
  });
});
