import type { Page } from "@playwright/test";
import {
  Api,
  createEmailMember,
  createSchoolWorld,
  unique,
} from "../support/api";
import { expect, test } from "../support/fixtures";

/** Bulle d'un message dans la conversation ouverte (pas l'aperçu de la liste). */
const bubble = (page: Page, text: string) =>
  page.locator("p").filter({ hasText: text });

test.describe("Messagerie", () => {
  test("le prof écrit à un élève, l'élève répond @mobile", async ({
    pageAs,
  }) => {
    const admin = await Api.admin();
    const world = await createSchoolWorld(admin);
    await admin.dispose();
    const question = unique("Bonjour, as-tu commencé le devoir ?");
    const reply = unique("Oui madame, presque fini.");

    const prof = await pageAs("prof");
    await prof.goto("/prof/messages");
    await prof
      .getByRole("button", { name: /Nouveau/ })
      .first()
      .click();
    const dialog = prof.getByRole("dialog", { name: "Nouveau message" });
    const to = dialog.getByRole("combobox", { name: "Destinataire" });
    const value = await to
      .locator("option", { hasText: world.learner.name })
      .getAttribute("value");
    await to.selectOption(value ?? "");
    await dialog.getByRole("textbox").fill(question);
    await dialog.getByRole("button", { name: "Envoyer" }).click();
    await expect(bubble(prof, question)).toBeVisible();

    const learner = await pageAs(world.learner);
    await learner.goto("/eleve/messages");
    await learner.getByText("Mme Prof Démo").first().click();
    await expect(bubble(learner, question)).toBeVisible();
    await learner.getByRole("textbox").last().fill(reply);
    await learner.getByRole("button", { name: "Envoyer" }).click();
    await expect(bubble(learner, reply)).toBeVisible();

    await prof.reload();
    await prof.getByText(world.learner.name).first().click();
    await expect(bubble(prof, reply)).toBeVisible();
  });
});

test.describe("Messagerie : interdits", () => {
  test.use({ allowedConsole: [/status of 403/] });

  test("un élève ne peut pas écrire à un autre élève", async ({ pageAs }) => {
    const admin = await Api.admin();
    const world = await createSchoolWorld(admin);
    // Un camarade dans la même classe.
    const mate = await createEmailMember(
      admin,
      world.schoolId,
      "Élève",
      unique("Camarade"),
    );
    await admin.post(`/api/admin/classes/${world.classId}/members`, {
      userId: mate.userId,
      role: "learner",
    });
    await admin.dispose();

    // L'interface ne propose que les profs de ses classes…
    const page = await pageAs(world.learner);
    await page.goto("/eleve/messages");
    await page
      .getByRole("button", { name: /Nouveau|Écrire/ })
      .first()
      .click();
    const dialog = page.getByRole("dialog", { name: "Écrire à un prof" });
    const options = dialog.getByRole("combobox").locator("option");
    await expect(options.filter({ hasText: "Mme Prof Démo" })).toHaveCount(1);
    await expect(options.filter({ hasText: "Élève" })).toHaveCount(0);

    // …et l'API refuse un envoi direct vers un camarade de classe.
    const learnerApi = await Api.login(
      world.learner.email,
      world.learner.password,
    );
    const res = await learnerApi.ctx.post("/api/messages/send", {
      data: {
        to: { kind: "user", userId: mate.userId },
        body: "Salut !",
      },
    });
    expect(res.status()).toBe(403);
    await learnerApi.dispose();
  });
});
