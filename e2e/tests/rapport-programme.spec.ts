import { readFile } from "node:fs/promises";
import { app } from "../env";
import { Api, items, str, unique } from "../support/api";
import { expect, test } from "../support/fixtures";

test.describe("Programme proposé par l'IA", () => {
  test.use({
    storageState: "./.auth/admin.json",
    // Le cycle volontaire est refusé par l'API (422), que Chrome signale.
    allowedConsole: [/status of 422/],
  });

  test("sans IA : message propre ; avec une proposition injectée : relecture puis import « à valider »", async ({
    page,
  }) => {
    await page.goto(app("/admin/referentiel"));
    await page.getByRole("link", { name: /France/ }).click();
    const panel = page.locator("#programme-ia");
    await expect(
      panel.getByRole("heading", { name: "Programme proposé par l'IA" }),
    ).toBeVisible();
    // L'API des tests tourne sans IA : la génération est fermée, avec un message clair.
    await expect(panel.getByText(/L'IA est indisponible/)).toBeVisible();
    await panel.getByLabel("Texte du programme").fill("Chapitre 1 : test.");
    await expect(
      panel.getByRole("button", { name: "Proposer une structure" }),
    ).toBeDisabled();

    // Proposition injectée à la place de la réponse de l'IA.
    const tag = unique("ia").toLowerCase();
    const proposal = {
      units: [
        {
          name: `Unité ${tag}`,
          notions: [
            {
              code: `${tag}-a`,
              name: `Notion A ${tag}`,
              objective: "Savoir faire A.",
              prerequisites: [],
            },
            {
              code: `${tag}-b`,
              name: `Notion B ${tag}`,
              objective: "Savoir faire B.",
              prerequisites: [`${tag}-a`],
            },
            {
              code: `${tag}-c`,
              name: `Notion C ${tag}`,
              objective: "Savoir faire C.",
              prerequisites: [],
            },
          ],
        },
      ],
    };
    await page.route("**/api/admin/curriculum-generate/status", (route) =>
      route.fulfill({ json: { aiConfigured: true } }),
    );
    await page.route(
      "**/api/admin/curriculum-generate/countries/*/generate",
      (route) =>
        route.fulfill({ json: { proposal, issues: [], existingCodes: [] } }),
    );
    await page.reload();
    await panel.getByLabel("Matière").selectOption({ label: "Mathématiques" });
    await panel.getByLabel("Texte du programme").fill("Chapitre 1 : test.");
    await panel.getByRole("button", { name: "Proposer une structure" }).click();

    await expect(
      panel.getByRole("heading", { name: "Relecture de la proposition" }),
    ).toBeVisible();
    const notions = panel.getByTestId("proposal-notion");
    await expect(notions).toHaveCount(3);
    await expect(notions.first().getByText("À valider")).toBeVisible();
    // Supprimer, réordonner, modifier.
    await panel
      .getByRole("button", { name: `Supprimer la notion « Notion C ${tag} »` })
      .click();
    await expect(notions).toHaveCount(2);
    await panel
      .getByRole("button", { name: `Descendre « Notion A ${tag} »` })
      .click();
    await expect(notions.first().getByLabel("Code")).toHaveValue(`${tag}-b`);
    await notions.first().getByLabel("Nom").fill(`Notion B relue ${tag}`);

    // Un cycle est refusé avant l'import.
    await notions.nth(1).getByLabel("Prérequis").fill(`${tag}-b`);
    await panel.getByRole("button", { name: "Vérifier l'import" }).click();
    await expect(panel.getByText(/À corriger avant l'import/)).toBeVisible();
    await notions.nth(1).getByLabel("Prérequis").fill("");

    await panel.getByRole("button", { name: "Vérifier l'import" }).click();
    await expect(panel.getByText("Nouvelles notions (2)")).toBeVisible();
    await panel
      .getByRole("button", { name: "Importer (notions à valider)" })
      .click();
    await expect(panel.getByText(/Programme importé/)).toBeVisible();

    // En base : les notions existent et ne sont pas validées.
    const admin = await Api.admin();
    const france = items(
      await admin.get("/api/admin/curriculum/countries"),
      "countries",
    ).find((c) => c.code === "FR");
    const curriculum = await admin.get(
      `/api/admin/curriculum/countries/${str(france, "id")}/curriculum`,
    );
    const created = items(curriculum, "notions").filter((n) =>
      String(n.code).startsWith(tag),
    );
    await admin.dispose();
    expect(created.map((n) => [n.code, n.name, n.verified]).sort()).toEqual([
      [`${tag}-a`, `Notion A ${tag}`, false],
      [`${tag}-b`, `Notion B relue ${tag}`, false],
    ]);
  });
});

test.describe("Rapport de progression", () => {
  test("le prof choisit sa classe et une période, exporte en CSV", async ({
    pageAs,
  }) => {
    const prof = await pageAs("prof");
    await prof.goto(app("/prof"));
    await prof.getByRole("link", { name: "Rapport" }).first().click();
    await expect(
      prof.getByRole("heading", { level: 1, name: "Rapport de progression" }),
    ).toBeVisible();
    await prof.getByLabel("Classe").selectOption({ label: "4e A · Maths" });
    await prof.getByRole("button", { name: "Afficher", exact: true }).click();
    await expect(
      prof.getByRole("heading", { level: 2, name: "4e A · Maths" }),
    ).toBeVisible();
    for (const name of [
      "Répartition par statut",
      "Notions les plus travaillées",
      "Idées fausses les plus fréquentes",
    ])
      await expect(prof.getByRole("heading", { name })).toBeVisible();
    await expect(prof.getByText("Élèves actifs")).toBeVisible();
    await expect(
      prof.getByRole("button", { name: "Imprimer ou PDF" }),
    ).toBeVisible();

    const [download] = await Promise.all([
      prof.waitForEvent("download"),
      prof.getByRole("link", { name: "Exporter en CSV" }).click(),
    ]);
    const path = await download.path();
    const csv = await readFile(path, "utf8");
    expect(csv).toContain("Rapport de progression");
    expect(csv).toContain("Classe;4e A · Maths");

    // Une période à l'envers est refusée proprement.
    await prof.getByLabel("Du").fill("2026-05-01");
    await prof.getByLabel("Au").fill("2026-04-01");
    await prof.getByRole("button", { name: "Afficher", exact: true }).click();
    await expect(prof.getByText(/Période invalide/)).toBeVisible();
  });

  test("la direction ouvre le rapport depuis l'espace école", async ({
    pageAs,
  }) => {
    const direction = await pageAs("direction");
    await direction.goto(app("/ecole"));
    await direction
      .getByRole("link", { name: /Rapport/ })
      .first()
      .click();
    await expect(
      direction.getByRole("heading", {
        level: 1,
        name: "Rapport de progression",
      }),
    ).toBeVisible();
    await direction
      .getByLabel("Classe")
      .selectOption({ label: "4e A · Maths" });
    await direction
      .getByRole("button", { name: "Afficher", exact: true })
      .click();
    await expect(direction.getByText("Élèves actifs")).toBeVisible();
  });
});
