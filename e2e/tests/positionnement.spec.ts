import type { Page } from "@playwright/test";
import { app } from "../env";
import { Api, createFamilyWorld, items } from "../support/api";
import { expect, test } from "../support/fixtures";

/** Écrit une réponse dans le champ mathématique (MathLive). */
async function type(page: Page, value: string) {
  await expect(page.getByText("Chargement du champ mathématique…")).toHaveCount(
    0,
  );
  const field = page.locator("math-field");
  await field.click();
  await field.pressSequentially(value);
  await expect(field).toHaveJSProperty("value", value);
}

test.describe("Test de niveau", () => {
  test("avant tout abonnement : introduction, questions sans correction, bilan, puis un seul test par période @mobile", async ({
    pageAs,
  }) => {
    // Un élève d'une école sans contrat, sans abonnement : la matière est fermée.
    const admin = await Api.admin();
    const family = await createFamilyWorld(admin);
    await admin.dispose();
    const api = await Api.login(family.child.email, family.child.password);
    const path = await api.get("/api/learner/path");
    expect(items(path, "classes")[0]?.open).toBe(false);
    const before = items(await api.get("/api/learner/placement"), "subjects");
    expect(before).toHaveLength(1);
    expect(before[0]).toMatchObject({
      state: "not_started",
      hasQuestions: true,
    });

    const page = await pageAs(family.child);
    await page.goto(app("/eleve/positionnement"));
    await expect(
      page.getByRole("heading", { level: 1, name: "Test de niveau" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Commencer le test" }).click();
    await expect(page.getByText("Ce n'est pas une note")).toBeVisible();
    await page.getByRole("button", { name: "Commencer le test" }).click();

    // Une question à la fois, jamais de correction, jusqu'au bilan.
    const result = page.getByRole("heading", {
      level: 1,
      name: /Votre bilan en/,
    });
    for (let i = 0; i < 12; i++) {
      const question = page.getByText(`Question ${i + 1}`, { exact: true });
      await expect(question.or(result)).toBeVisible({ timeout: 15_000 });
      if (await result.isVisible()) break;
      await expect(
        page.getByRole("progressbar", { name: "Avancement du test" }),
      ).toBeVisible();
      if (i % 2 === 0) {
        await type(page, "1");
        await page
          .getByRole("button", { name: "Valider et continuer" })
          .click();
      } else {
        await page.getByRole("button", { name: "Je ne sais pas" }).click();
      }
      await expect(page.getByText(/Bravo|Pas encore/)).toHaveCount(0);
    }
    await expect(result).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole("heading", { name: /À reprendre/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Faire connaissance avec votre prof IA" }),
    ).toHaveAttribute("href", /\/eleve\/prof-ia\?mode=intake/);

    // Fait, et pas de nouveau test complet avant la fin de la période.
    const after = items(await api.get("/api/learner/placement"), "subjects");
    expect(after[0]).toMatchObject({ state: "done" });
    expect(after[0]?.availableAt).toEqual(expect.any(String));
    const again = await api.ctx.post(
      `/api/learner/placement/${String(after[0]?.subjectId)}/start`,
    );
    expect(again.status()).toBe(409);
    expect(await again.json()).toMatchObject({
      error: { code: "placement_cooldown" },
    });
    // Le test n'a pas ouvert la matière.
    expect(items(await api.get("/api/learner/path"), "classes")[0]?.open).toBe(
      false,
    );
    await api.dispose();
  });
});
