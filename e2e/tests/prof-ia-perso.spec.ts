import { app } from "../env";
import { Api, createSchoolWorld, str } from "../support/api";
import { expect, test } from "../support/fixtures";

test.describe("Prof IA plus humain", () => {
  test("l'élève choisit le prénom et l'avatar de son prof IA à la première séance ; il le retrouve à l'accueil @mobile", async ({
    pageAs,
  }) => {
    const admin = await Api.admin();
    const world = await createSchoolWorld(admin);
    await admin.dispose();
    // Première séance : l'entretien de découverte (gratuit).
    const learnerApi = await Api.login(
      world.learner.email,
      world.learner.password,
    );
    const session = await learnerApi.post("/api/learner/tutor/sessions", {
      mode: "intake",
    });
    const sessionId = str(session.session, "id");
    await learnerApi.dispose();

    const page = await pageAs(world.learner);
    await page.goto(app(`/eleve/prof-ia/${sessionId}`));
    await expect(
      page.getByRole("heading", { name: "Choisissez votre prof IA" }),
    ).toBeVisible();

    // Un prénom qui n'est pas fait de lettres est refusé avant l'envoi.
    const name = page.getByLabel("Prénom", { exact: true });
    await name.fill("R2D2");
    await expect(page.getByText(/Seulement des lettres/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Enregistrer" }),
    ).toBeDisabled();

    // L'avatar est une carte de choix (radio) : on clique dessus.
    await page.getByRole("radio", { name: "Hibou" }).click();
    await expect(page.getByRole("radio", { name: "Hibou" })).toBeChecked();
    await name.fill("Awa");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(
      page.getByRole("heading", { name: "Choisissez votre prof IA" }),
    ).toHaveCount(0);
    // Le prof IA parle sous son prénom.
    await expect(page.getByRole("log").getByText("Awa")).toBeVisible();

    await page.goto(app("/eleve"));
    await expect(page.getByText("Awa, votre prof IA")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Parler avec Awa" }),
    ).toBeVisible();

    // Dans le profil, le choix est repris et modifiable.
    await page.goto(app("/eleve/profil"));
    await expect(page.getByLabel("Prénom", { exact: true })).toHaveValue("Awa");
    await expect(page.getByRole("radio", { name: "Hibou" })).toBeChecked();
  });

  test("un encouragement s'affiche, se ferme, et pas deux dans la même période", async ({
    pageAs,
  }) => {
    const admin = await Api.admin();
    const world = await createSchoolWorld(admin);
    await admin.dispose();
    const page = await pageAs(world.learner);
    await page.goto(app("/eleve"));
    await expect(
      page.getByRole("heading", { level: 1, name: "Mon espace" }),
    ).toBeVisible();

    const fire = (trigger: string) =>
      page.evaluate(
        (detail) =>
          window.dispatchEvent(new CustomEvent("wema:encourage", { detail })),
        trigger,
      );
    const toast = page.getByTestId("encouragement");
    // Le message attend que la page soit prête (hydratée) pour écouter.
    await expect(async () => {
      await fire("success");
      await expect(toast).toBeVisible({ timeout: 1000 });
    }).toPass();
    await expect(toast).toContainText("Vous avez trouvé par vous-même");
    await page.getByRole("button", { name: "Fermer le message" }).click();
    await expect(toast).toHaveCount(0);
    // Même période : rien de plus.
    await fire("step");
    await expect(toast).toHaveCount(0);
  });

  test.describe("notes libres du prof", () => {
    // Le refus d'une note de santé est une réponse 422 voulue.
    test.use({ allowedConsole: [/status of 422/] });
    test("le prof ajoute une note libre ; une note de santé est refusée", async ({
      pageAs,
    }) => {
      const admin = await Api.admin();
      const world = await createSchoolWorld(admin);
      await admin.dispose();
      const page = await pageAs("prof");
      await page.goto(
        app(`/prof/eleves/${world.schoolId}/${world.learner.userId}`),
      );
      await expect(
        page.getByRole("heading", { name: "Notes libres" }),
      ).toBeVisible();

      const note = page.getByLabel("Nouvelle note");
      await note.fill("Je pense qu'il est dyslexique.");
      await page.getByRole("button", { name: "Ajouter la note" }).click();
      await expect(
        page.getByText(/évoque la santé ou un trouble/),
      ).toBeVisible();

      await note.fill("Comprend mieux quand on part d'un exemple.");
      await page.getByRole("button", { name: "Ajouter la note" }).click();
      await expect(
        page
          .getByRole("list", { name: "Notes sur l'élève" })
          .getByText("Comprend mieux quand on part d'un exemple."),
      ).toBeVisible();
      await expect(page.getByText(/évoque la santé/)).toHaveCount(0);
    });
  });
});
