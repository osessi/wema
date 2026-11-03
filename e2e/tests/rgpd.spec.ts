import { readFile } from "node:fs/promises";
import { Api, createSchoolWorld } from "../support/api";
import { expect, test } from "../support/fixtures";

test.describe("RGPD", () => {
  test("export de mes données : fichier JSON téléchargé", async ({
    pageAs,
  }) => {
    const admin = await Api.admin();
    const world = await createSchoolWorld(admin);
    await admin.dispose();

    const page = await pageAs(world.learner);
    await page.goto("/compte");
    await expect(
      page.getByRole("heading", { level: 1, name: "Mon compte" }),
    ).toBeVisible();
    const download = page.waitForEvent("download");
    await page.getByRole("link", { name: "Télécharger (JSON)" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe("wema-mes-donnees.json");
    const path = await file.path();
    const data = JSON.parse(await readFile(path, "utf8"));
    // Le fichier contient bien ce compte (et lui seul).
    expect(JSON.stringify(data)).toContain(world.learner.email);
    expect(JSON.stringify(data)).not.toContain("prof@wema.test");
  });
});
