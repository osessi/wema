import type { Page } from "@playwright/test";
import { app } from "../env";
import {
  Api,
  createSchoolWorld,
  giveAssignment,
  platformExercise,
} from "../support/api";
import { expect, test } from "../support/fixtures";

/** Écrit une réponse dans le champ mathématique (MathLive) et la vérifie. */
async function answer(page: Page, value: string) {
  await expect(page.getByText("Chargement du champ mathématique…")).toHaveCount(
    0,
  );
  // Le champ est un <math-field> : on clique dessus, puis on tape au clavier.
  const field = page.locator("math-field");
  // Efface l'essai précédent (sans événement : la saisie qui suit en envoie).
  await field.evaluate((el) => Reflect.set(el, "value", ""));
  await field.click();
  await field.pressSequentially(value);
  await expect(field).toHaveJSProperty("value", value);
  await page.getByRole("button", { name: "Vérifier ma réponse" }).click();
}

test.describe("Élève", () => {
  test("accueil, exercice : « Pas encore » puis « Bravo », progression mise à jour @mobile", async ({
    pageAs,
  }) => {
    const admin = await Api.admin();
    const world = await createSchoolWorld(admin);
    // Une notion du programme de la classe (4e) : elle figure dans la progression.
    await giveAssignment(
      admin,
      world.classId,
      await platformExercise(
        admin,
        "Résoudre une équation du premier degré",
        world.programId,
      ),
      "Devoir e2e · équations",
    );
    await admin.dispose();

    const page = await pageAs(world.learner);
    await page.goto(app("/eleve"));
    await expect(
      page.getByRole("heading", { level: 1, name: "Mon espace" }),
    ).toBeVisible();
    await expect(page.getByText("Devoir e2e · équations")).toBeVisible();
    await page.getByRole("link", { name: "Commencer l'exercice" }).click();
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Devoir e2e · équations",
      }),
    ).toBeVisible();

    // Niveau 1 : ax + b = c, a et b positifs, solution entière.
    const statement = await page
      .getByText(/Résous l'équation/)
      .first()
      .textContent();
    const m = (statement ?? "").match(/(\d+)\s*x\s*\+\s*(\d+)\s*=\s*(-?\d+)/);
    expect(m, `énoncé inattendu : ${statement}`).not.toBeNull();
    const [a, b, c] = [Number(m?.[1]), Number(m?.[2]), Number(m?.[3])];
    const right = (c - b) / a;
    expect(Number.isInteger(right), `solution non entière : ${statement}`).toBe(
      true,
    );

    await answer(page, String(right + 1));
    await expect(page.getByText("Pas encore", { exact: true })).toBeVisible();
    // Une mauvaise réponse n'est jamais présentée comme « Faux ».
    await expect(page.getByText(/\bFaux\b/)).toHaveCount(0);

    await answer(page, String(right));
    await expect(page.getByText("Bravo, c'est juste !")).toBeVisible();

    await page.goto(app("/eleve/progression"));
    const notion = page
      .getByRole("listitem")
      .filter({ hasText: "Équations du premier degré" });
    await expect(notion).toBeVisible();
    await expect(notion).not.toContainText("Pas encore travaillée");
  });

  test("formats : schéma et lecture facile", async ({ pageAs }) => {
    const admin = await Api.admin();
    const world = await createSchoolWorld(admin);
    await giveAssignment(
      admin,
      world.classId,
      await platformExercise(
        admin,
        "Résoudre une équation du premier degré",
        world.programId,
      ),
      "Devoir e2e · équation",
    );
    await admin.dispose();

    const page = await pageAs(world.learner);
    await page.goto(app("/eleve/exercices"));
    await page.getByRole("link", { name: "Faire l'exercice" }).first().click();
    const formats = page.getByRole("radiogroup", {
      name: "Comment voulez-vous lire l'énoncé ?",
    });
    await expect(formats).toBeVisible();

    // Schéma : une balance à l'équilibre (l'inconnue reste « ? »).
    await formats.getByRole("radio", { name: /Schéma/ }).click();
    await expect(
      page.getByRole("img", { name: /Balance à l'équilibre/ }),
    ).toBeVisible();

    // Lecture facile : sans IA configurée, l'énoncé reste lisible en texte.
    await formats.getByRole("radio", { name: /Lecture facile/ }).click();
    await expect(page.getByText(/Résous l'équation/).first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Vérifier ma réponse" }),
    ).toBeVisible();
  });

  test("prof IA indisponible : message clair, pas de plantage", async ({
    pageAs,
  }) => {
    const admin = await Api.admin();
    const world = await createSchoolWorld(admin);
    await admin.dispose();
    const page = await pageAs(world.learner);
    await page.goto(app("/eleve/prof-ia"));
    await expect(
      page.getByRole("heading", { level: 1, name: "Prof IA" }),
    ).toBeVisible();
  });
});
