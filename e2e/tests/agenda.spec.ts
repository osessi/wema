import { app } from "../env";
import {
  Api,
  createEmailMember,
  organizationByName,
  str,
  unique,
} from "../support/api";
import { expect, test } from "../support/fixtures";

test.describe("Agenda", () => {
  test("disponibilité du prof, réservation par l'élève, confirmation", async ({
    pageAs,
  }) => {
    // Un prof et un élève neufs (sans parent : l'élève réserve lui-même).
    const admin = await Api.admin();
    const school = await organizationByName(admin, "Collège démo");
    const teacher = await createEmailMember(
      admin,
      school,
      "Prof",
      unique("Prof Agenda"),
    );
    const learnerName = unique("Élève Agenda");
    const learner = await createEmailMember(
      admin,
      school,
      "Élève",
      learnerName,
    );
    const classId = str(
      await admin.post(`/api/admin/organizations/${school}/classes`, {
        name: unique("Classe agenda"),
        programId: null,
      }),
      "id",
    );
    for (const [userId, role] of [
      [teacher.userId, "teacher"],
      [learner.userId, "learner"],
    ])
      await admin.post(`/api/admin/classes/${classId}/members`, {
        userId,
        role,
      });
    await admin.dispose();

    // Disponibilité : tous les jours, de 8 h à 20 h.
    const prof = await pageAs(teacher);
    await prof.goto(app("/prof/agenda"));
    await prof
      .getByRole("button", { name: "Ajouter une disponibilité" })
      .click();
    const rule = prof.getByRole("dialog", {
      name: "Ajouter une disponibilité",
    });
    for (const day of ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]) {
      const button = rule.getByRole("button", { name: day, exact: true });
      if ((await button.getAttribute("aria-pressed")) !== "true")
        await button.click();
    }
    await rule.getByLabel("De").fill("08:00");
    await rule.getByLabel("À", { exact: true }).fill("20:00");
    await rule.getByRole("button", { name: "Enregistrer" }).click();
    await expect(rule).toBeHidden();
    await expect(prof.getByText("Aucune disponibilité.")).toHaveCount(0);

    // Réservation par l'élève : le premier créneau libre.
    const page = await pageAs(learner);
    await page.goto(app("/eleve/agenda"));
    await page.getByRole("button", { name: "Réserver une séance" }).click();
    const booking = page.getByRole("dialog", { name: "Réserver une séance" });
    await expect(
      booking.getByText("Recherche des créneaux libres…"),
    ).toHaveCount(0);
    if (
      await booking.getByText("Aucun créneau libre cette semaine.").isVisible()
    )
      await booking.getByRole("button", { name: "Semaine suivante" }).click();
    // Chaque créneau porte son nom complet (« Créneau du mardi 4 novembre,
    // de 17:00 à 17:30 ») : le jour se lit sans voir la colonne.
    await booking
      .getByRole("button", {
        name: /^Créneau du .+, de \d{1,2}:\d{2} à \d{1,2}:\d{2}$/,
      })
      .first()
      .click();
    await expect(booking.getByText("Créneau choisi :")).toBeVisible();
    await booking.getByRole("button", { name: "Envoyer la demande" }).click();
    await expect(
      page.getByText("Demande envoyée. Le prof va répondre."),
    ).toBeVisible();

    // Le prof confirme la demande.
    await prof.reload();
    await prof.getByRole("button", { name: "Confirmer" }).first().click();
    await expect(prof.getByRole("button", { name: "Confirmer" })).toHaveCount(
      0,
    );

    // L'élève voit sa séance à venir, confirmée.
    await page.reload();
    await expect(
      page.getByRole("listitem").filter({ hasText: "Confirmée" }),
    ).toHaveCount(1);
  });
});
