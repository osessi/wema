import type { AiProvider, ProviderRequest } from "@wema/ai-gateway";
import { createEventStore } from "@wema/db";
import { asLearnerId, ok } from "@wema/domain";
import { describe, expect, it } from "vitest";
import { ADMIN, browser, field, testServer, text } from "./test-helpers";

const usage = { inputTokens: 1, outputTokens: 1, costUsd: 0 };

/** Faux fournisseur d'IA : réponses prévues dans l'ordre ; requêtes gardées. */
function scripted(answers: unknown[], seen: ProviderRequest[]): AiProvider {
  return {
    name: "openrouter",
    generate: async (r) => {
      seen.push(r);
      return ok({ text: JSON.stringify(answers.shift()), model: "m", usage });
    },
    stream: async () => ok({ text: "", model: "m", usage }),
  };
}

const comics = (question: string) => ({
  title: "Le marché",
  characters: [{ id: "awa", name: "Awa", look: "round", color: "mint" }],
  panels: [
    {
      place: "shop",
      setting: "Un étal avec une balance.",
      caption: null,
      bubbles: [{ speaker: "awa", kind: "speech", text: "Une énigme !" }],
    },
    {
      place: "shop",
      setting: "Awa regarde la balance.",
      caption: "Les plateaux sont à l'équilibre.",
      bubbles: [],
    },
    {
      place: "shop",
      setting: "Awa tend un papier.",
      caption: null,
      bubbles: [{ speaker: "awa", kind: "thought", text: question }],
    },
  ],
});

async function setup(answers: unknown[], seen: ProviderRequest[]) {
  const server = await testServer({}, undefined, scripted(answers, seen));
  const { app, platformId } = server;
  const admin = browser(app);
  await admin.post("/auth/login", ADMIN);
  const id = async (path: string, body: unknown) =>
    text((await admin.post(path, body)).json, "id");
  const countryId = await id("/admin/curriculum/countries", {
    code: "FR",
    name: "France",
    unitLabel: { singular: "C", plural: "C" },
  });
  const subjectId = await id("/admin/curriculum/subjects", {
    code: "maths",
    name: "Mathématiques",
  });
  const gradeId = await id(`/admin/curriculum/countries/${countryId}/grades`, {
    name: "4e",
    position: 0,
  });
  const programId = await id("/admin/curriculum/programs", {
    gradeId,
    subjectId,
  });
  const unitId = await id("/admin/curriculum/units", {
    programId,
    name: "U",
    description: "",
    position: 0,
  });
  const notionId = await id("/admin/curriculum/notions", {
    unitId,
    code: "eq",
    name: "Équations",
    description: "Résoudre ax + b = c.",
    position: 0,
  });
  const roleId = await id(`/admin/organizations/${platformId}/roles`, {
    name: "Élève",
    permissions: [],
  });
  const pupil = async (username: string) => {
    const created = await admin.post(
      `/admin/organizations/${platformId}/members`,
      {
        displayName: "Élève Démo",
        roleId,
        login: { kind: "username", username },
      },
    );
    const b = browser(app);
    await b.post("/auth/learner", {
      username,
      code: text(created.json, "loginCode"),
    });
    return { browser: b, userId: text(created.json, "userId") };
  };
  const learner = await pupil("eleve.formats");
  const other = await pupil("eleve.autre");
  const range = (min: number, max: number) => [{ min, max }];
  const intentId = await id(`/admin/organizations/${platformId}/exercises`, {
    notionId,
    objective: "Résoudre",
    misconceptionId: null,
    statement: "Résous {equation}.",
    task: { kind: "solve", equation: "a*x + b = c", variable: "x" },
    parameters: [
      { name: "a", ranges: range(2, 5), exclude: [] },
      { name: "b", ranges: range(1, 9), exclude: [] },
      { name: "c", ranges: range(20, 40), exclude: [] },
    ],
    constraints: [],
    steps: [],
    expected: null,
  });
  await admin.post(`/admin/exercises/${intentId}/validate`);
  await admin.post(
    `/admin/organizations/${platformId}/exercises/${intentId}/variants`,
    { learnerIds: [learner.userId] },
  );
  const variants = field(
    (await learner.browser.get("/learner/variants")).json,
    "variants",
  );
  const first = Array.isArray(variants) ? variants[0] : null;
  return {
    ...server,
    admin,
    intentId,
    learner,
    other,
    variantId: text(first, "id"),
    statement: text(first, "statement"),
  };
}

describe("formats adaptés", () => {
  it("propose le texte par défaut, avec le schéma de la balance tiré des paramètres", async () => {
    const ctx = await setup([], []);
    const res = await ctx.learner.browser.get(
      `/learner/variants/${ctx.variantId}/presentation`,
    );
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({
      format: "text",
      reason: "default",
      manipulable: "balance",
      figure: { kind: "balance", variable: "x" },
      comics: null,
      easyReadingAdapted: false,
    });
    expect(field(res.json, "formats")).toEqual(
      expect.arrayContaining(["text", "diagram", "comics", "easy_reading"]),
    );
    // La variante d'un autre élève reste invisible.
    expect(
      (
        await ctx.other.browser.get(
          `/learner/variants/${ctx.variantId}/presentation`,
        )
      ).status,
    ).toBe(404);
  });

  it("suit la préférence déclarée, met la BD en cache et journalise le format de la réponse", async () => {
    const seen: ProviderRequest[] = [];
    const answers: unknown[] = [];
    const ctx = await setup(answers, seen);
    await ctx.learner.browser.post("/learner/preferences", {
      key: "format.comics",
      value: true,
    });
    const presentation = await ctx.learner.browser.get(
      `/learner/variants/${ctx.variantId}/presentation`,
    );
    expect(presentation.json).toMatchObject({
      format: "comics",
      reason: "preference",
    });

    // L'énoncé vérifié est recopié tel quel dans la dernière case.
    answers.push(comics(ctx.statement));
    const path = `/learner/variants/${ctx.variantId}/render`;
    const first = await ctx.learner.browser.post(path, { format: "comics" });
    expect(first.json).toMatchObject({ status: "ok", format: "comics" });
    const again = await ctx.learner.browser.post(path, { format: "comics" });
    expect(again.json).toMatchObject({ status: "ok" });
    expect(seen).toHaveLength(1);
    // La réponse attendue n'est jamais envoyée à l'IA.
    expect(JSON.stringify(seen[0]?.messages)).not.toContain("x = 1");

    await ctx.learner.browser.post(
      `/learner/variants/${ctx.variantId}/answer`,
      {
        response: "x = 1",
        hintsUsed: 0,
        format: "comics",
      },
    );
    const events = await createEventStore(ctx.db).listByLearner(
      asLearnerId(ctx.learner.userId),
    );
    const answer = events.find((e) => e.payload.type === "answer.submitted");
    expect(answer?.payload).toMatchObject({ format: "comics", correct: true });
  });

  it("une reformulation qui change un nombre est écartée : on garde le texte, sans repayer", async () => {
    const seen: ProviderRequest[] = [];
    const answers: unknown[] = [{ sentences: ["Résous 99x = 1."] }];
    const ctx = await setup(answers, seen);
    const path = `/learner/variants/${ctx.variantId}/render`;
    const res = await ctx.learner.browser.post(path, {
      format: "easy_reading",
    });
    expect(res.json).toMatchObject({
      status: "fallback",
      easyReading: { sentences: [ctx.statement] },
    });
    await ctx.learner.browser.post(path, { format: "easy_reading" });
    expect(seen).toHaveLength(1);
  });

  it("aperçu du prof : même variante (graine) dans un autre format, avec sa figure", async () => {
    const answers: unknown[] = [];
    const ctx = await setup(answers, []);
    const base = `/admin/organizations/${ctx.platformId}/exercises/${ctx.intentId}/preview`;
    const plain = await ctx.admin.post(base, { level: 1, scaffolded: false });
    expect(plain.json).toMatchObject({
      figure: { kind: "balance" },
      manipulable: "balance",
      rendering: null,
    });
    const seed = field(plain.json, "variant", "seed");
    const statement = text(plain.json, "variant", "statement");
    answers.push({ sentences: [statement] });
    const easy = await ctx.admin.post(base, {
      level: 1,
      scaffolded: false,
      seed,
      format: "easy_reading",
    });
    expect(text(easy.json, "variant", "statement")).toBe(statement);
    expect(easy.json).toMatchObject({
      rendering: { status: "ok", easyReading: { sentences: [statement] } },
    });
  });
});
