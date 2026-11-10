import type { Page } from "@playwright/test";
import { app } from "../env";
import {
  Api,
  createFamilyWorld,
  ensureOffer,
  giveAssignment,
  platformExercise,
} from "../support/api";
import { expect, test } from "../support/fixtures";

async function submitAnswer(page: Page, value: string) {
  await expect(page.getByText("Chargement du champ mathématique…")).toHaveCount(
    0,
  );
  const field = page.locator("math-field");
  await field.click();
  await field.pressSequentially(value);
  await page.getByRole("button", { name: "Vérifier ma réponse" }).click();
}

test.describe("Parent", () => {
  test("fiche de l'enfant : déclarer un besoin avec consentement, puis le retirer", async ({
    pageAs,
  }) => {
    const admin = await Api.admin();
    const family = await createFamilyWorld(admin);
    await admin.dispose();

    const page = await pageAs(family.parent);
    await page.goto(app("/parent"));
    await expect(page.getByText(family.child.name)).toBeVisible();
    await page.getByRole("link", { name: "Voir la fiche" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: family.child.name }),
    ).toBeVisible();

    await expect(page.getByText("Aucun besoin déclaré.")).toBeVisible();
    await page.getByRole("combobox", { name: "Besoin" }).click();
    await page.getByRole("option").first().click();
    const declare = page.getByRole("button", { name: "Déclarer ce besoin" });
    // Sans consentement, rien n'est enregistré.
    await expect(declare).toBeDisabled();
    await page.getByRole("checkbox", { name: /J'autorise Wema/ }).check();
    await declare.click();
    await expect(page.getByText("Aucun besoin déclaré.")).toBeHidden();

    // Retrait, après confirmation : la déclaration est effacée.
    await page
      .getByRole("button", { name: /Retirer/ })
      .first()
      .click();
    await page
      .getByRole("dialog", { name: /^Retirer « .+ » \?$/ })
      .getByRole("button", { name: "Retirer et effacer" })
      .click();
    await expect(page.getByText("Aucun besoin déclaré.")).toBeVisible();
  });
});

test.describe("Paiement", () => {
  // Avant le paiement, la réponse de l'élève est refusée (402, voulu).
  test.use({ allowedConsole: [/status of 402/] });

  test("enfant hors contrat : refusé, paiement par le faux fournisseur, accès ouvert", async ({
    pageAs,
  }) => {
    const admin = await Api.admin();
    const family = await createFamilyWorld(admin);
    await ensureOffer(admin);
    await giveAssignment(
      admin,
      family.classId,
      await platformExercise(admin, "Calculer le carré d'un nombre"),
      "Devoir e2e · paiement",
    );
    await admin.dispose();

    // L'élève n'a pas encore accès : message clair vers les abonnements.
    const learner = await pageAs(family.child);
    await learner.goto(app("/eleve/exercices"));
    await learner
      .getByRole("link", { name: "Faire l'exercice" })
      .first()
      .click();
    await submitAnswer(learner, "4");
    await expect(
      learner.getByText(/pas encore ouvert pour vous/),
    ).toBeVisible();

    // Le parent paie la matière (faux fournisseur de développement).
    const parent = await pageAs(family.parent);
    await parent.goto(app("/parent/abonnements"));
    await expect(parent.getByText("9,90 € par mois")).toBeVisible();
    await parent
      .getByRole("button", { name: "Payer et activer · Carte bancaire" })
      .click();
    await expect(parent.getByRole("status")).toContainText(
      "Paiement confirmé : la matière est ouverte.",
    );
    await parent.getByRole("link", { name: "Retour aux abonnements" }).click();
    await expect(
      parent.getByRole("heading", { name: "Matières suivies" }),
    ).toBeVisible();
    await expect(parent.getByText("Mathématiques").first()).toBeVisible();

    // L'élève peut maintenant répondre.
    await learner.reload();
    await submitAnswer(learner, "4");
    await expect(learner.getByText(/pas encore ouvert pour vous/)).toHaveCount(
      0,
    );
    await expect(
      learner.getByText(/Bravo, c'est juste !|Pas encore/).first(),
    ).toBeVisible();
  });
});
