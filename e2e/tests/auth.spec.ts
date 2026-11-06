import { ADMIN, app } from "../env";
import {
  Api,
  createEmailMember,
  organizationByName,
  roleByName,
  str,
  unique,
} from "../support/api";
import { expect, test } from "../support/fixtures";

test.describe("Connexion", () => {
  test("par e-mail et mot de passe @mobile", async ({ page }) => {
    await page.goto(app("/connexion"));
    await page.getByLabel("Adresse e-mail").fill("prof@wema.test");
    await page.getByLabel("Mot de passe").fill("demo-wema-2026");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL(/\/prof$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Mes classes" }),
    ).toBeVisible();
  });

  test("compte élève : identifiant et code @mobile", async ({ page }) => {
    const admin = await Api.admin();
    const school = await organizationByName(admin, "Collège démo");
    const username = unique("eleve").toLowerCase();
    const created = await admin.post(
      `/api/admin/organizations/${school}/members`,
      {
        displayName: "Élève Identifiant",
        roleId: await roleByName(admin, school, "Élève"),
        login: { kind: "username", username },
      },
    );
    await admin.dispose();

    await page.goto(app("/connexion"));
    await page.getByRole("tab", { name: "Élève" }).click();
    await page.getByLabel("Identifiant").fill(username);
    await page.getByLabel("Code de connexion").fill(str(created, "loginCode"));
    await page.getByRole("button", { name: "Se connecter" }).click();
    // Premier passage : les conditions à accepter, puis l'espace élève.
    await expect(page).toHaveURL(/\/compte\/conditions/);
    await page.getByRole("checkbox", { name: /J'ai lu et j'accepte/ }).check();
    await page.getByRole("button", { name: "Accepter et continuer" }).click();
    await expect(page).toHaveURL(/\/eleve$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Mon espace" }),
    ).toBeVisible();
  });

  test("déconnexion", async ({ pageAs }) => {
    const admin = await Api.admin();
    const school = await organizationByName(admin, "Collège démo");
    const account = await createEmailMember(
      admin,
      school,
      "Prof",
      "Prof Sortie",
    );
    await admin.dispose();

    const page = await pageAs(account);
    // La lecture des messages non lus est retenue jusqu'après la déconnexion :
    // elle doit être abandonnée, pas revenir en 401 (erreur dans la console).
    let release = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/notifications/unread", async (route) => {
      await held;
      await route.continue().catch(() => {});
    });
    const unread = page.waitForEvent("requestfailed", (r) =>
      r.url().includes("/api/notifications/unread"),
    );
    await page.goto(app("/prof"));
    await page.getByRole("button", { name: "Mon compte" }).click();
    await page.getByRole("menuitem", { name: "Se déconnecter" }).click();
    await expect(page).toHaveURL(/\/connexion/);
    release();
    await unread;
    await page.unroute("**/api/notifications/unread");
    // La session est bien fermée : l'espace renvoie à la connexion.
    await page.goto(app("/prof"));
    await expect(page).toHaveURL(/\/connexion/);
  });
});

test.describe("Inscription", () => {
  test("création de compte avec acceptation des conditions @mobile", async ({
    page,
  }) => {
    await page.goto(app("/inscription"));
    // Un parent (choix par défaut) est ensuite guidé vers sa famille.
    await expect(page.getByRole("radio", { name: /^Parent/ })).toBeChecked();
    await page.getByLabel("Votre nom").fill("Parent Inscrit");
    await page
      .getByLabel("Adresse e-mail")
      .fill(`${unique("inscrit")}@wema.test`);
    await page.getByLabel("Mot de passe").fill("mot-de-passe-solide");
    await page.getByLabel("Année de naissance").fill("1985");
    const submit = page.getByRole("button", { name: "Créer mon compte" });
    // Sans les conditions acceptées, impossible de créer le compte.
    await expect(submit).toBeDisabled();
    await page.getByRole("checkbox").check();
    await submit.click();
    // Conditions déjà acceptées à l'inscription : pas de second passage.
    await expect(page).toHaveURL(/\/famille\/creer$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Créer ma famille" }),
    ).toBeVisible();
  });
});

test.describe("Refus attendus", () => {
  // Le navigateur signale dans la console les réponses 401 et 409 voulues.
  test.use({ allowedConsole: [/status of 40[19]/] });

  test("mauvais mot de passe : message clair, pas de connexion", async ({
    page,
  }) => {
    await page.goto(app("/connexion"));
    await page.getByLabel("Adresse e-mail").fill("prof@wema.test");
    await page.getByLabel("Mot de passe").fill("pas-le-bon-mot-de-passe");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: /./ }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/connexion/);
  });

  test("le super admin ne peut pas être recréé par l'inscription", async ({
    page,
  }) => {
    await page.goto(app("/inscription"));
    await page.getByLabel("Votre nom").fill("Usurpateur");
    await page.getByLabel("Adresse e-mail").fill(ADMIN.email);
    await page.getByLabel("Mot de passe").fill("mot-de-passe-solide");
    await page.getByLabel("Année de naissance").fill("1985");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Créer mon compte" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: /./ }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/inscription/);
  });
});
