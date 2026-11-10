import { app } from "../env";
import { expect, test } from "../support/fixtures";

// Vitrine des composants : publique, non indexée, interactive.
test.describe("Vitrine des composants", () => {
  test("ouverte sans session, sommaire et sections @mobile", async ({
    pageAs,
  }) => {
    const page = await pageAs(null);
    await page.goto(app("/composants"));
    await expect(page).toHaveURL(/\/composants$/);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "La boîte à outils de Wema",
      }),
    ).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
    );
    const toc = page.getByRole("navigation", { name: "Sommaire" });
    await expect(toc.getByRole("link")).toHaveCount(13);
    for (const title of ["Fondations", "Prof IA", "Illustrations", "Icônes"])
      await expect(
        page.getByRole("heading", { level: 2, name: title }),
      ).toBeAttached();

    // Les figures Hairline sont décoratives.
    const figure = page.locator('[data-slot="illustration"]').first();
    await expect(figure).toHaveAttribute("aria-hidden", "true");
  });

  test("bascule du thème et indice du prof IA", async ({ pageAs }) => {
    const page = await pageAs(null);
    await page.goto(app("/composants"));
    await page.getByRole("button", { name: "Sombre · Nuit" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.getByRole("button", { name: "Clair · Crayon" }).click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);

    const thread = page.getByRole("log", {
      name: "Conversation avec le prof IA",
    });
    await page.getByRole("button", { name: /^Indice \(3 restants\)/ }).click();
    await expect(thread.getByText("Indice 1 sur 3")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^Indice \(2 restants\)/ }),
    ).toBeVisible();
  });
});
