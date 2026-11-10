import { app } from "../env";
import {
  Api,
  createEmailMember,
  ensureOffer,
  organizationByName,
  roleByName,
  unique,
} from "../support/api";
import { expect, test } from "../support/fixtures";

/** Rôle « Conseiller Wema » de la plateforme (créé si besoin). */
async function ensureAdvisorRole(admin: Api, platformId: string) {
  try {
    await roleByName(admin, platformId, "Conseiller Wema");
  } catch {
    const res = await admin.ctx.post(
      `/api/admin/organizations/${platformId}/roles`,
      {
        data: { name: "Conseiller Wema", permissions: ["diagnostic.conduct"] },
      },
    );
    // 409 : un autre scénario vient de le créer.
    expect([201, 409]).toContain(res.status());
  }
}

test.describe("Parcours guidé du parent", () => {
  test("inscription, famille, enfant, accès, test de niveau, paiement, rendez-vous de diagnostic ; le conseiller le voit @mobile", async ({
    page,
    pageAs,
  }) => {
    // Une offre de maths en France, et une conseillère disponible tous les jours.
    const admin = await Api.admin();
    await ensureOffer(admin);
    const platformId = await organizationByName(admin, "Wema");
    await ensureAdvisorRole(admin, platformId);
    const advisor = await createEmailMember(
      admin,
      platformId,
      "Conseiller Wema",
      "Conseillère e2e",
    );
    await admin.dispose();
    const advisorApi = await Api.login(advisor.email, advisor.password);
    await advisorApi.post("/api/agenda/availability", {
      weekdays: [1, 2, 3, 4, 5, 6, 7],
      startTime: "00:00",
      endTime: "23:45",
      timeZone: "UTC",
      validFrom: new Date().toISOString().slice(0, 10),
      validUntil: null,
      slotMinutes: 15,
    });
    await advisorApi.dispose();

    // 1. Le parent s'inscrit : le parcours guidé commence.
    await page.goto(app("/inscription"));
    await page.getByRole("radio", { name: /^Parent/ }).check();
    await page.getByLabel("Votre nom").fill("Parent Guidé");
    await page
      .getByLabel("Adresse e-mail")
      .fill(`${unique("guide")}@wema.test`);
    await page.getByLabel("Mot de passe").fill("mot-de-passe-solide");
    await page.getByLabel("Année de naissance").fill("1984");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Créer mon compte" }).click();
    await expect(page).toHaveURL(/\/famille\/demarrer$/);
    await expect(
      page.getByRole("heading", { name: "Bienvenue sur Wema" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Commencer" }).click();

    // 2. Sa famille.
    await page.getByLabel("Nom de la famille").fill(unique("Famille"));
    await page.getByRole("button", { name: "Créer ma famille" }).click();
    await expect(page).toHaveURL(/etape=enfant/);

    // 3. Son enfant : prénom, identifiant, France, 4e, maths.
    const username = unique("guide").toLowerCase();
    await page.getByLabel("Prénom").fill("Ama");
    await page.getByLabel("Identifiant", { exact: true }).fill(username);
    await page.getByLabel("Pays").selectOption({ label: "France" });
    await page
      .getByLabel("Classe", { exact: true })
      .selectOption({ label: "4e" });
    await page.getByRole("checkbox", { name: "Mathématiques" }).check();
    await page.getByRole("checkbox", { name: /Je suis le parent/ }).check();
    await page.getByRole("button", { name: "Ajouter cet enfant" }).click();

    // 4. Son accès, affiché en grand, à imprimer ou à copier.
    await expect(page).toHaveURL(/etape=acces/);
    await expect(
      page.getByRole("heading", { name: "Accès de Ama" }),
    ).toBeVisible();
    await expect(page.getByText(username, { exact: true })).toBeVisible();
    const code = (
      await page
        .getByText("Code", { exact: true })
        .locator("xpath=following-sibling::dd")
        .textContent()
    )?.trim();
    expect(code, "code de connexion affiché").toBeTruthy();
    await expect(page.getByRole("button", { name: "Imprimer" })).toBeVisible();
    await page.getByRole("link", { name: "Continuer" }).click();

    // 5. Le test de niveau se fait depuis le compte de l'enfant.
    await expect(page).toHaveURL(/etape=test/);
    await expect(page.getByText("Pas encore fait")).toBeVisible();
    await page.getByRole("link", { name: "Passer cette étape" }).click();

    // 6. Abonnement : les offres de l'admin (faux fournisseur de paiement).
    await expect(page).toHaveURL(/etape=abonnement/);
    await page
      .getByRole("button", { name: "Payer et activer · Carte bancaire" })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "Paiement confirmé : la matière est ouverte.",
    );

    // 7. Rendez-vous de diagnostic, une fois l'abonnement payé.
    await page.goto(app("/famille/demarrer?etape=diagnostic"));
    await page
      .getByRole("button", { name: "Réserver le rendez-vous de diagnostic" })
      .click();
    await page
      .getByRole("group", { name: /Créneaux libres pour Ama/ })
      .getByRole("radio")
      .first()
      .click();
    await page.getByRole("button", { name: "Réserver ce créneau" }).click();
    await expect(page.getByText(/Rendez-vous prévu avec/)).toBeVisible();

    // L'accueil parent montre la liste de démarrage, test de niveau restant.
    await page.goto(app("/parent"));
    await expect(
      page.getByRole("heading", { name: "Pour bien démarrer" }),
    ).toBeVisible();
    await expect(page.getByText("5 sur 6 étapes faites")).toBeVisible();

    // La conseillère voit le rendez-vous et ouvre la fiche.
    const advisorPage = await pageAs(advisor);
    await advisorPage.goto(app("/admin/diagnostic"));
    await expect(advisorPage.getByText("Ama")).toBeVisible();
    await advisorPage.getByRole("link", { name: "Ouvrir la fiche" }).click();
    await advisorPage
      .getByLabel("Sa motivation")
      .fill("Veut comprendre les fractions");
    await advisorPage.getByRole("button", { name: "Enregistrer" }).click();
    await expect(advisorPage.getByText("Fiche enregistrée.")).toBeVisible();

    // L'enfant se connecte : son accueil propose d'abord le test de niveau.
    const child = await pageAs(null);
    await child.goto(app("/connexion"));
    await child.getByRole("tab", { name: "Élève" }).click();
    await child.getByLabel("Identifiant").fill(username);
    await child.getByLabel("Code de connexion").fill(code ?? "");
    await child.getByRole("button", { name: "Se connecter" }).click();
    await child.getByRole("checkbox", { name: /J'ai lu et j'accepte/ }).check();
    await child.getByRole("button", { name: "Accepter et continuer" }).click();
    await expect(child).toHaveURL(/\/eleve$/);
    await expect(
      child.getByRole("heading", { name: "Faisons connaissance" }),
    ).toBeVisible();
    await expect(
      child.getByRole("link", { name: /Commencer le test/ }),
    ).toBeVisible();
  });
});
