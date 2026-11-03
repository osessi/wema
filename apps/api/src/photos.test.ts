import type { AiProvider, ProviderRequest } from "@wema/ai-gateway";
import { createEventStore } from "@wema/db";
import { asLearnerId, ok } from "@wema/domain";
import { describe, expect, it } from "vitest";
import { MAX_PHOTO_BYTES, sniffImage } from "./routes/photos";
import { ADMIN, browser, field, testServer, text, WEB } from "./test-helpers";

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

// En-têtes minimaux de vraies images (contenu fictif).
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
const HEIC = new Uint8Array([
  0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63,
]);

const review = (misconceptionId: string) => ({
  readable: true,
  steps: [
    { text: "2x + 3 = 5", correct: true },
    { text: "2x = 5 + 3", correct: false },
    { text: "2x = 8", correct: true },
  ],
  stuckStep: 1,
  issue: "Le 3 change de côté sans changer de signe.",
  misconceptionId,
  misconceptionConfidence: 0.9,
  feedback:
    "Bien posé ! Sur ta deuxième ligne, que fais-tu aux deux membres pour enlever le + 3 ?",
});

async function setup(answers: unknown[], seen: ProviderRequest[] = []) {
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
  const misconceptionId = await id(
    `/admin/curriculum/notions/${notionId}/misconceptions`,
    { description: "Change de côté sans changer de signe." },
  );
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
  const learner = await pupil("eleve.photo");
  const other = await pupil("eleve.autre");
  const intentId = await id(`/admin/organizations/${platformId}/exercises`, {
    notionId,
    objective: "Résoudre",
    misconceptionId: null,
    statement: "Résous {equation}.",
    task: { kind: "solve", equation: "a*x + b = c", variable: "x" },
    parameters: [{ name: "a", ranges: [{ min: 2, max: 5 }], exclude: [] }],
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
  const variantId = text(Array.isArray(variants) ? variants[0] : null, "id");

  const send = async (
    who: ReturnType<typeof browser>,
    path: string,
    file: Blob | null,
  ) => {
    const form = new FormData();
    if (file) form.append("photo", file, "copie");
    const res = await app.request(`/api${path}`, {
      method: "POST",
      headers: { origin: WEB, cookie: who.cookie() },
      body: form,
    });
    return { status: res.status, json: await res.json() };
  };
  return {
    ...server,
    learner,
    other,
    variantId,
    misconceptionId,
    send,
  };
}

describe("photo d'une copie", () => {
  it("reconnaît le format réel de l'image", () => {
    expect(sniffImage(JPEG)).toBe("image/jpeg");
    expect(sniffImage(PNG)).toBe("image/png");
    expect(sniffImage(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe(
      "image/webp",
    );
    expect(sniffImage(HEIC)).toBe("heic");
    expect(sniffImage(new TextEncoder().encode("%PDF-1.7"))).toBeNull();
  });

  it("relit la copie, répond sans la réponse, journalise l'observation et ne garde pas la photo", async () => {
    const seen: ProviderRequest[] = [];
    const answers: unknown[] = [];
    const ctx = await setup(answers, seen);
    answers.push(review(ctx.misconceptionId));
    const res = await ctx.send(
      ctx.learner.browser,
      `/learner/variants/${ctx.variantId}/photo`,
      new Blob([JPEG], { type: "image/jpeg" }),
    );
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({
      review: {
        readable: true,
        stuckStep: 1,
        steps: [
          { status: "correct" },
          { status: "incorrect" },
          { status: "unverified" },
        ],
      },
    });
    // L'idée fausse reste dans le profil, pas dans le retour à l'élève.
    expect(JSON.stringify(res.json)).not.toContain(ctx.misconceptionId);
    expect(seen[0]?.messages[1]?.images?.[0]?.mediaType).toBe("image/jpeg");

    const events = await createEventStore(ctx.db).listByLearner(
      asLearnerId(ctx.learner.userId),
    );
    const copy = events.find((e) => e.payload.type === "copy.reviewed");
    expect(copy?.source).toBe("paper");
    expect(copy?.payload).toMatchObject({
      misconceptionId: ctx.misconceptionId,
      stuckStep: 1,
      exerciseRef: ctx.variantId,
    });
    // Une copie n'est jamais une réponse : rien ne compte pour la maîtrise.
    expect(events.some((e) => e.payload.type === "answer.submitted")).toBe(
      false,
    );
    const stored = await ctx.db.query(
      "SELECT payload::text AS p FROM learning_events",
    );
    expect(JSON.stringify(stored)).not.toContain("/9j/");
  });

  it("photo illisible : un retour, aucun événement", async () => {
    const answers: unknown[] = [];
    const ctx = await setup(answers);
    answers.push({
      ...review(ctx.misconceptionId),
      readable: false,
      steps: [],
    });
    const res = await ctx.send(
      ctx.learner.browser,
      `/learner/variants/${ctx.variantId}/photo`,
      new Blob([PNG], { type: "image/png" }),
    );
    expect(res).toEqual({ status: 200, json: { review: { readable: false } } });
    const events = await createEventStore(ctx.db).listByLearner(
      asLearnerId(ctx.learner.userId),
    );
    expect(events).toEqual([]);
  });

  it("droits : seulement sur sa propre variante, avec une session", async () => {
    const ctx = await setup([]);
    const photo = new Blob([JPEG], { type: "image/jpeg" });
    const path = `/learner/variants/${ctx.variantId}/photo`;
    expect((await ctx.send(ctx.other.browser, path, photo)).status).toBe(404);
    const anonymous = await ctx.app.request(`/api${path}`, {
      method: "POST",
      headers: { origin: WEB },
      body: new FormData(),
    });
    expect(anonymous.status).toBe(401);
    expect(
      (
        await ctx.send(
          ctx.learner.browser,
          "/learner/variants/00000000-0000-4000-8000-000000000001/photo",
          photo,
        )
      ).status,
    ).toBe(404);
  });

  it("validation : fichier absent, format refusé (HEIC, PDF), taille maximale", async () => {
    const seen: ProviderRequest[] = [];
    const ctx = await setup([], seen);
    const path = `/learner/variants/${ctx.variantId}/photo`;
    const call = (file: Blob | null) =>
      ctx.send(ctx.learner.browser, path, file);
    expect(await call(null)).toMatchObject({
      status: 422,
      json: { error: { code: "photo_missing" } },
    });
    expect(await call(new Blob([HEIC], { type: "image/heic" }))).toMatchObject({
      status: 415,
      json: { error: { code: "photo_unsupported_format" } },
    });
    // Type annoncé trompeur : c'est le contenu qui compte.
    expect(
      (await call(new Blob(["%PDF-1.7"], { type: "image/jpeg" }))).status,
    ).toBe(415);
    const big = new Uint8Array(MAX_PHOTO_BYTES + 1);
    big.set(JPEG);
    expect(await call(new Blob([big], { type: "image/jpeg" }))).toMatchObject({
      status: 413,
      json: { error: { code: "photo_too_large" } },
    });
    // Aucun appel à l'IA pour une photo refusée.
    expect(seen).toEqual([]);
  });

  it("sécurité : la relecture ne sert pas d'oracle illimité de la réponse (plafond par variante, essais épuisés)", async () => {
    const seen: ProviderRequest[] = [];
    const answers: unknown[] = [];
    const ctx = await setup(answers, seen);
    const path = `/learner/variants/${ctx.variantId}/photo`;
    const photo = () => new Blob([JPEG], { type: "image/jpeg" });
    for (let i = 0; i < 3; i++) {
      answers.push(review(ctx.misconceptionId));
      expect((await ctx.send(ctx.learner.browser, path, photo())).status).toBe(
        200,
      );
    }
    answers.push(review(ctx.misconceptionId));
    expect(await ctx.send(ctx.learner.browser, path, photo())).toMatchObject({
      status: 409,
      json: { error: { code: "photo_limit_reached" } },
    });
    expect(seen.length).toBe(3);

    // Essais épuisés : plus de relecture (sinon on testerait la réponse sans fin).
    const other = await setup([], []);
    for (const response of ["x = 100", "x = 101", "x = 102"])
      await other.learner.browser.post(
        `/learner/variants/${other.variantId}/answer`,
        { response, hintsUsed: 0 },
      );
    expect(
      await other.send(
        other.learner.browser,
        `/learner/variants/${other.variantId}/photo`,
        photo(),
      ),
    ).toMatchObject({
      status: 409,
      json: { error: { code: "attempts_exhausted" } },
    });
  });

  it("sécurité : des envois simultanés ne dépassent pas le plafond par variante", async () => {
    const seen: ProviderRequest[] = [];
    const answers: unknown[] = [];
    const ctx = await setup(answers, seen);
    for (let i = 0; i < 5; i++) answers.push(review(ctx.misconceptionId));
    const path = `/learner/variants/${ctx.variantId}/photo`;
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        ctx.send(
          ctx.learner.browser,
          path,
          new Blob([JPEG], { type: "image/jpeg" }),
        ),
      ),
    );
    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 200).length).toBeLessThanOrEqual(3);
    expect(statuses).toContain(409);
    expect(seen.length).toBeLessThanOrEqual(3);
  });

  it("IA indisponible : erreur claire, aucun événement", async () => {
    const ctx = await setup([{ readable: "peut-être" }]);
    const res = await ctx.send(
      ctx.learner.browser,
      `/learner/variants/${ctx.variantId}/photo`,
      new Blob([JPEG], { type: "image/jpeg" }),
    );
    expect(res).toMatchObject({
      status: 503,
      json: { error: { code: "ai_unavailable" } },
    });
  });
});
