import { expect, test } from "../support/fixtures";

test.describe("Accès interdits", () => {
  test.use({ storageState: "./.auth/eleve2.json" });

  for (const path of [
    "/admin",
    "/admin/reglages",
    "/prof",
    "/ecole",
    "/parent",
  ])
    test(`un élève qui tape ${path} est renvoyé dans son espace @mobile`, async ({
      page,
    }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/eleve$/);
      await expect(
        page.getByRole("heading", { level: 1, name: "Mon espace" }),
      ).toBeVisible();
    });

  test("l'API refuse le back-office à un élève", async ({ page }) => {
    // (La liste des organisations, elle, ne montre que les siennes.)
    const res = await page.request.get("/api/admin/audit");
    expect(res.status()).toBe(403);
  });
});

test.describe("Sans session", () => {
  for (const path of ["/eleve", "/prof", "/admin", "/compte"])
    test(`${path} renvoie à la connexion`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/connexion/);
    });
});
