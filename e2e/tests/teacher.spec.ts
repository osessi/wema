import type { Page } from "@playwright/test";
import { app } from "../env";
import { Api, createSchoolWorld } from "../support/api";
import { expect, test } from "../support/fixtures";

/** Choisit une option d'une liste déroulante (Radix Select). */
async function choose(page: Page, label: string | RegExp, option: RegExp) {
  await page.getByRole("combobox", { name: label }).click();
  await page.getByRole("option", { name: option }).first().click();
}

test.describe("Prof", () => {
  test("carte de la classe, donner un devoir, l'élève le voit", async ({
    pageAs,
  }) => {
    const admin = await Api.admin();
    const world = await createSchoolWorld(admin);
    await admin.dispose();

    const prof = await pageAs("prof");
    await prof.goto(app("/prof"));
    await prof.getByRole("link", { name: world.className }).click();
    await expect(
      prof.getByRole("heading", { level: 1, name: world.className }),
    ).toBeVisible();
    // Carte : la notion choisie montre où en est chaque élève.
    await expect(
      prof.getByRole("heading", { name: "Constellation des notions" }),
    ).toBeVisible();
    // La classe suit le programme de 4e de la démonstration.
    await prof
      .getByRole("button", { name: /Équations du premier degré .*ont validé/ })
      .click();
    await expect(
      prof.getByRole("link", { name: world.learner.name }).first(),
    ).toBeVisible();

    await prof.getByRole("tab", { name: "Devoirs" }).click();
    await prof.getByRole("button", { name: "Donner un devoir" }).click();
    const dialog = prof.getByRole("dialog", { name: "Donner un devoir" });
    await choose(prof, "Exercice", /pourcentage/i);
    await dialog.getByLabel("Titre du devoir").fill("Devoir e2e · prof");
    await dialog.getByRole("button", { name: "Donner le devoir" }).click();
    await expect(dialog).toBeHidden({ timeout: 30_000 });
    await expect(
      prof.getByRole("row", { name: /Devoir e2e · prof/ }),
    ).toBeVisible();

    const learner = await pageAs(world.learner);
    await learner.goto(app("/eleve/devoirs"));
    await expect(learner.getByText("Devoir e2e · prof")).toBeVisible();
  });

  test("banque : déposer un exercice, le retenir, le donner", async ({
    pageAs,
  }) => {
    const admin = await Api.admin();
    const world = await createSchoolWorld(admin);
    await admin.dispose();

    const prof = await pageAs("prof");
    await prof.goto(app("/prof/banque"));
    await prof.getByRole("button", { name: "Déposer un exercice" }).click();
    const add = prof.getByRole("dialog", {
      name: "Déposer un exercice dans la banque",
    });
    await choose(prof, "Exercice", /./);
    const chosen = (
      await add.getByRole("combobox", { name: "Exercice" }).textContent()
    )?.trim();
    await add.getByRole("button", { name: "Déposer" }).click();
    await expect(add).toBeHidden();

    const entry = prof
      .getByRole("listitem")
      .filter({ hasText: chosen ?? "" })
      .filter({ has: prof.getByRole("button", { name: "Retenir" }) })
      .first();
    await entry.getByRole("button", { name: "Retenir" }).click();
    await prof.getByRole("radio", { name: /Retenus/ }).click();
    const kept = prof
      .getByRole("listitem")
      .filter({ hasText: chosen ?? "" })
      .filter({ has: prof.getByRole("button", { name: "Donner en devoir" }) })
      .first();
    await kept.getByRole("button", { name: "Donner en devoir" }).click();
    const give = prof.getByRole("dialog", { name: "Donner un devoir" });
    await choose(prof, "Classe", new RegExp(world.className));
    await give.getByLabel("Titre du devoir").fill("Devoir e2e · banque");
    await give.getByRole("button", { name: "Donner le devoir" }).click();
    await expect(give).toBeHidden({ timeout: 30_000 });

    const learner = await pageAs(world.learner);
    await learner.goto(app("/eleve/devoirs"));
    await expect(learner.getByText("Devoir e2e · banque")).toBeVisible();
  });
});
