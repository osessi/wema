import { app } from "../env";
import {
  Api,
  createEmailMember,
  createFamilyWorld,
  str,
  unique,
} from "../support/api";
import { expect, test } from "../support/fixtures";

/** Code de pays de trois lettres, propre au scénario (aucun autre n'en dépend). */
function countryCode(): string {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return Array.from(
    { length: 3 },
    () => letters[Math.floor(Math.random() * letters.length)],
  ).join("");
}

test.describe("Parent : semaine et partage", () => {
  test("résumé de la semaine sur l'accueil et la fiche ; partage proposé seulement avec une école", async ({
    pageAs,
  }) => {
    const admin = await Api.admin();
    const family = await createFamilyWorld(admin);

    // Une seconde famille dont l'enfant n'a aucune école.
    const lonelyId = str(
      await admin.post("/api/admin/organizations", {
        name: unique("Famille sans école"),
        kind: "family",
      }),
      "id",
    );
    for (const [name, permissions] of [
      ["Parent", ["learners.read", "learners.health.write"]],
      ["Enfant", []],
    ] as const)
      await admin.post(`/api/admin/organizations/${lonelyId}/roles`, {
        name,
        permissions,
      });
    const lonelyParent = await createEmailMember(
      admin,
      lonelyId,
      "Parent",
      "Parent sans école",
    );
    const lonelyChildName = unique("Enfant seul");
    const lonelyChild = await createEmailMember(
      admin,
      lonelyId,
      "Enfant",
      lonelyChildName,
    );
    await admin.post(`/api/admin/organizations/${lonelyId}/guardianships`, {
      guardianId: lonelyParent.userId,
      learnerId: lonelyChild.userId,
    });
    await admin.dispose();

    // Avec école : résumé sur l'accueil, puis bloc de partage sur la fiche.
    const page = await pageAs(family.parent);
    await page.goto(app("/parent"));
    const summary = page.getByTestId("weekly-summary");
    await expect(summary).toBeVisible();
    await expect(
      summary.getByText("Aucune activité pour l'instant."),
    ).toBeVisible();
    await expect(
      summary.getByRole("img", { name: /Réponses par jour/ }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Voir la fiche" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: family.child.name }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Sa semaine" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Partage avec ses établissements" }),
    ).toBeVisible();

    // Sans école : pas de bloc de partage.
    const other = await pageAs(lonelyParent);
    await other.goto(app("/parent"));
    await other.getByRole("link", { name: "Voir la fiche" }).click();
    await expect(
      other.getByRole("heading", { level: 1, name: lonelyChildName }),
    ).toBeVisible();
    await expect(
      other.getByRole("heading", { name: "Sa semaine" }),
    ).toBeVisible();
    await expect(
      other.getByRole("heading", { name: "Partage avec ses établissements" }),
    ).toHaveCount(0);
  });
});

test.describe("Séance payante", () => {
  test("l'admin fixe un prix, le parent réserve et paie, la séance est confirmée", async ({
    pageAs,
  }) => {
    // Un pays propre au scénario, son programme, et la classe de l'enfant dessus.
    const admin = await Api.admin();
    const family = await createFamilyWorld(admin);
    const countryName = unique("Pays séance");
    const countryId = str(
      await admin.post("/api/admin/curriculum/countries", {
        code: countryCode(),
        name: countryName,
        unitLabel: { singular: "Chapitre", plural: "Chapitres" },
      }),
      "id",
    );
    const gradeId = str(
      await admin.post(`/api/admin/curriculum/countries/${countryId}/grades`, {
        name: "4e",
        position: 0,
      }),
      "id",
    );
    const subjects = await admin.get("/api/admin/curriculum/subjects");
    const maths = (
      Array.isArray(subjects.subjects) ? subjects.subjects : []
    ).find(
      (s: unknown) =>
        typeof s === "object" &&
        s !== null &&
        "code" in s &&
        s.code === "maths",
    );
    const programId = str(
      await admin.post("/api/admin/curriculum/programs", {
        gradeId,
        subjectId: str(maths, "id"),
      }),
      "id",
    );
    const schoolId = str(
      (await admin.get(`/api/admin/classes/${family.classId}`)).class,
      "organizationId",
    );
    const classId = str(
      await admin.post(`/api/admin/organizations/${schoolId}/classes`, {
        name: unique("Classe séance"),
        programId,
      }),
      "id",
    );
    await admin.post(`/api/admin/organizations/${schoolId}/roles`, {
      name: "Prof",
      permissions: ["exercises.read"],
    });
    const teacher = await createEmailMember(
      admin,
      schoolId,
      "Prof",
      unique("Prof séance"),
    );
    for (const [userId, role] of [
      [teacher.userId, "teacher"],
      [family.child.userId, "learner"],
    ])
      await admin.post(`/api/admin/classes/${classId}/members`, {
        userId,
        role,
      });
    await admin.dispose();

    const prof = await Api.login(teacher.email, teacher.password);
    await prof.post("/api/agenda/availability", {
      weekdays: [1, 2, 3, 4, 5, 6, 7],
      startTime: "08:00",
      endTime: "20:00",
      timeZone: "UTC",
      validFrom: new Date().toISOString().slice(0, 10),
      validUntil: null,
      everyNWeeks: 1,
      slotMinutes: 60,
    });
    await prof.dispose();

    // L'admin saisit le prix dans Offres (aucun prix par défaut).
    const back = await pageAs("admin");
    await back.goto(app("/admin/offres"));
    const form = back.locator("form").filter({
      has: back.getByRole("button", { name: "Enregistrer le prix" }),
    });
    await form.getByLabel("Pays").selectOption({ label: countryName });
    await form.getByLabel("Devise (ISO 4217)").fill("EUR");
    await form.getByLabel("Prix").fill("25");
    await form.getByRole("checkbox", { name: "Carte bancaire" }).check();
    await form.getByRole("button", { name: "Enregistrer le prix" }).click();
    await expect(back.getByText("Prix de la séance enregistré.")).toBeVisible();

    try {
      // Le parent voit le prix, réserve et paie (faux fournisseur).
      const page = await pageAs(family.parent);
      await page.goto(app("/parent/agenda"));
      await page
        .getByRole("button", { name: "Réserver une séance" })
        .first()
        .click();
      const booking = page.getByRole("dialog", { name: "Réserver une séance" });
      await expect(booking.getByTestId("booking-price")).toContainText("25,00");
      await expect(
        booking.getByText("Recherche des créneaux libres…"),
      ).toHaveCount(0);
      if (
        await booking
          .getByText("Aucun créneau libre cette semaine.")
          .isVisible()
      )
        await booking.getByRole("button", { name: "Semaine suivante" }).click();
      await booking
        .getByRole("button", {
          name: /^Créneau du .+, de \d{1,2}:\d{2} à \d{1,2}:\d{2}$/,
        })
        .first()
        .click();
      await booking.getByRole("button", { name: "Réserver et payer" }).click();

      // Retour du fournisseur sur la page de la séance : payée, donc confirmée.
      await expect(
        page.getByText("Paiement reçu : la séance est confirmée."),
      ).toBeVisible();
      await expect(page.getByTestId("session-payment")).toContainText(
        "Séance réglée",
      );
      await expect(page.getByText("Confirmée").first()).toBeVisible();
    } finally {
      const cleanup = await Api.admin();
      await cleanup.ctx.delete(
        `/api/admin/billing/session-prices/${countryId}`,
      );
      await cleanup.dispose();
    }
  });
});

test.describe("Back-office : à valider", () => {
  test("une notion à vérifier apparaît, avec le compteur du menu, puis se valide", async ({
    pageAs,
  }) => {
    const admin = await Api.admin();
    const countryName = unique("Pays à valider");
    const countryId = str(
      await admin.post("/api/admin/curriculum/countries", {
        code: countryCode(),
        name: countryName,
        unitLabel: { singular: "Chapitre", plural: "Chapitres" },
      }),
      "id",
    );
    const gradeId = str(
      await admin.post(`/api/admin/curriculum/countries/${countryId}/grades`, {
        name: "6e",
        position: 0,
      }),
      "id",
    );
    const subjectId = str(
      await admin.post("/api/admin/curriculum/subjects", {
        code: unique("mat")
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, ""),
        name: unique("Matière"),
      }),
      "id",
    );
    const programId = str(
      await admin.post("/api/admin/curriculum/programs", {
        gradeId,
        subjectId,
      }),
      "id",
    );
    const unitId = str(
      await admin.post("/api/admin/curriculum/units", {
        programId,
        name: "Unité",
        description: "",
        position: 0,
      }),
      "id",
    );
    const notionName = unique("Notion à valider");
    await admin.post("/api/admin/curriculum/notions", {
      unitId,
      code: "a-valider",
      name: notionName,
      description: "Une notion créée par le scénario.",
      position: 0,
    });
    await admin.dispose();

    const page = await pageAs("admin");
    await page.goto(app("/admin/a-valider"));
    // Pastille du menu : nombre d'éléments en attente.
    await expect(
      page.getByRole("link", { name: "À valider" }).first(),
    ).toBeVisible();
    await expect(page.getByLabel(/\d+ en attente/).first()).toBeVisible();

    // Filtre par pays : seule la notion du scénario.
    await page.getByLabel("Pays").selectOption({ label: countryName });
    await page.getByRole("button", { name: "Filtres" }).click();
    await expect(page.getByTestId("review-count")).toHaveText(
      "1 élément à valider",
    );
    await expect(page.getByText(notionName)).toBeVisible();
    await page.getByRole("button", { name: `Valider : ${notionName}` }).click();
    await expect(page.getByTestId("review-count")).toHaveText("Rien à valider");
  });
});
