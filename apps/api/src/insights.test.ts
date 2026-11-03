import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createAiGateway, DEFAULT_ROUTING } from "@wema/ai-gateway";
import { loadCurriculumSeed } from "@wema/curriculum";
import {
  createAiCallLog,
  createAiCostStore,
  createCurriculumStore,
  type SqlExecutor,
} from "@wema/db";
import { ok } from "@wema/domain";
import { describe, expect, it } from "vitest";
import { createSpendingGuard } from "./ai-setup";
import {
  ADMIN,
  browser,
  fakeAiProvider,
  field,
  testServer,
} from "./test-helpers";

const contentDir = fileURLToPath(
  new URL("../../../content/curriculum", import.meta.url),
);

async function adminWithFrance() {
  const server = await testServer();
  const seed = await loadCurriculumSeed(contentDir);
  if (!seed.ok) throw new Error(JSON.stringify(seed.error));
  const france = seed.value.find((c) => c.country.code === "FR");
  if (!france) throw new Error("FR absent");
  await createCurriculumStore(server.db).importCountry(france);
  const admin = browser(server.app);
  expect((await admin.post("/auth/login", ADMIN)).status).toBe(200);
  return { ...server, admin, france };
}

async function answer(
  db: SqlExecutor,
  learnerId: string,
  notionId: string,
  correct: boolean,
  minute: number,
) {
  await db.query(
    `INSERT INTO learning_events (id, learner_id, occurred_at, source, type, payload)
     VALUES ($1, $2, $3, 'web', 'answer.submitted', $4)`,
    [
      randomUUID(),
      learnerId,
      new Date(Date.UTC(2026, 10, 1, 9, minute)).toISOString(),
      JSON.stringify({
        type: "answer.submitted",
        notionId,
        correct,
        hintsUsed: 0,
        misconceptionId: null,
        exerciseRef: null,
        response: null,
        misconceptionSource: null,
        misconceptionConfidence: null,
        scaffolded: false,
      }),
    ],
  );
}

describe("apprentissage collectif anonymisé", () => {
  it("publie une notion à partir de 10 élèves, jamais en dessous", async () => {
    const { admin, db, france } = await adminWithFrance();
    const pythagore = france.notions.find((n) => n.code === "pythagore");
    const thales = france.notions.find((n) => n.code === "carres-racines");
    if (!pythagore || !thales) throw new Error("notions absentes");
    for (let i = 0; i < 10; i++) {
      const learner = randomUUID();
      await answer(db, learner, pythagore.id, i % 2 === 0, 0);
      await answer(db, learner, pythagore.id, true, 1);
      if (i < 9) await answer(db, learner, thales.id, true, 2);
    }
    expect((await admin.post("/admin/collective/compute")).json).toMatchObject({
      ok: true,
      notions: 1,
      minLearners: 10,
    });
    const all = await admin.get("/admin/collective");
    expect(all.status).toBe(200);
    expect(field(all.json, "minLearners")).toBe(10);
    const insights = field(all.json, "insights");
    expect(Array.isArray(insights) && insights.length).toBe(1);

    const forClass = await admin.get(
      `/admin/collective/notions?ids=${pythagore.id},${thales.id},pas-un-uuid`,
    );
    expect(forClass.status).toBe(200);
    const rows = field(forClass.json, "insights");
    expect(
      Array.isArray(rows) ? rows.map((r) => field(r, "notionId")) : [],
    ).toEqual([pythagore.id]);
    expect(Array.isArray(rows) && field(rows[0], "successRate")).toBe(0.75);

    const anonymous = browser((await testServer()).app);
    expect((await anonymous.get("/admin/collective")).status).toBe(401);
  });
});

describe("coûts de l'IA et plafonds", () => {
  it("tableau de bord, plafond global : alerte puis blocage des appels non essentiels", async () => {
    const { admin, db, platformId } = await adminWithFrance();
    const log = createAiCallLog(db);
    const ai = createAiGateway({
      providers: {
        openrouter: {
          ...fakeAiProvider,
          generate: async () =>
            ok({
              text: "Réponse de test",
              model: "test/modele",
              usage: { inputTokens: 5, outputTokens: 3, costUsd: 0.01 },
            }),
        },
      },
      routing: async () => DEFAULT_ROUTING,
      log: (e) => log.append(e),
      spendingGuard: createSpendingGuard(db),
    });
    const ask = (task: "nudge.write" | "tutor.reply") =>
      ai.generateText({
        task,
        messages: [{ role: "user", content: "bonjour" }],
        context: { organizationId: platformId, learnerId: null },
      });

    // Plafond de 0,02 $ (alerte à 50 %) ; chaque appel de test coûte 0,01 $.
    expect(
      (
        await admin.put("/admin/costs/caps", {
          organizationId: null,
          monthlyUsd: 0.02,
          alertRatio: 0.5,
        })
      ).status,
    ).toBe(200);
    expect((await ask("nudge.write")).ok).toBe(true);
    expect((await ask("nudge.write")).ok).toBe(true);
    const blocked = await ask("nudge.write");
    expect(!blocked.ok && blocked.error.kind).toBe("budget_exceeded");
    expect((await ask("tutor.reply")).ok).toBe(true);

    const alerts = await createAiCostStore(db).listAlerts(
      new Date(Date.UTC(2000, 0, 1)),
    );
    expect(alerts.map((a) => a.level).sort()).toEqual(["blocked", "warning"]);

    const board = await admin.get("/admin/costs");
    expect(board.status).toBe(200);
    expect(field(board.json, "totalCostUsd")).toBeCloseTo(0.03);
    const caps = field(board.json, "caps");
    expect(Array.isArray(caps) && field(caps[0], "level")).toBe("blocked");
    const byTask = field(board.json, "byTask");
    expect(
      Array.isArray(byTask) &&
        byTask.find((r) => field(r, "key") === "nudge.write"),
    ).toMatchObject({ calls: 3, errors: 1 });

    expect((await admin.delete("/admin/costs/caps")).status).toBe(200);
    expect((await ask("nudge.write")).ok).toBe(true);
    expect(
      (
        await admin.put("/admin/costs/caps", {
          organizationId: randomUUID(),
          monthlyUsd: 1,
        })
      ).status,
    ).toBe(404);
  });
});

describe("import et export du référentiel", () => {
  it("exporte, prévisualise puis applique un import CSV ; refuse un cycle", async () => {
    const { admin, france, app, db } = await adminWithFrance();
    const id = france.country.id;
    const res = await app.request(
      `/api/admin/curriculum-io/countries/${id}/export?format=yaml`,
      { headers: { cookie: admin.cookie() } },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toContain(
      "referentiel-fr.yaml",
    );
    expect(await res.text()).toContain("code: pythagore");

    const csv = [
      "classe,matiere,unite,code,nom,description,prerequis,idees_fausses",
      "4e,maths,Équations,inequations-4e,Inéquations,Résoudre une inéquation simple.,equations-1er-degre,Oublie de changer le sens en multipliant par un négatif",
    ].join("\n");
    const preview = await admin.post(
      `/admin/curriculum-io/countries/${id}/import/preview`,
      { format: "csv", content: csv },
    );
    expect(preview.status).toBe(200);
    expect(field(preview.json, "summary", "newNotions")).toEqual([
      "inequations-4e",
    ]);
    // L'aperçu n'écrit rien.
    const codes = async () =>
      (await createCurriculumStore(db).loadCountry(id))?.notions.map(
        (n) => n.code,
      ) ?? [];
    expect(await codes()).not.toContain("inequations-4e");

    const applied = await admin.post(
      `/admin/curriculum-io/countries/${id}/import/apply`,
      { format: "csv", content: csv },
    );
    expect(applied.status).toBe(200);
    expect(await codes()).toContain("inequations-4e");
    const again = await admin.post(
      `/admin/curriculum-io/countries/${id}/import/preview`,
      { format: "csv", content: csv },
    );
    expect(field(again.json, "empty")).toBe(true);

    const cycle = await admin.post(
      `/admin/curriculum-io/countries/${id}/import/preview`,
      {
        format: "csv",
        content:
          "classe,matiere,unite,code,nom,description,prerequis\n5e,maths,Calcul littéral,calcul-litteral,Calcul littéral,Réduire.,inequations-4e\n",
      },
    );
    expect(cycle.status).toBe(422);
    expect(field(cycle.json, "error", "code")).toBe("invalid_import");
  });

  it("importe en masse des exercices vérifiés par services/math, sans doublon", async () => {
    const { admin, france } = await adminWithFrance();
    const id = france.country.id;
    const content = [
      "- notion: equations-1er-degre",
      "  objective: Résoudre ax = b.",
      '  statement: "Résous {equation}."',
      '  task: { kind: solve, equation: "a*x = b", variable: x }',
      "  parameters:",
      "    - { name: a, ranges: [{ min: 2, max: 9 }] }",
      "    - { name: b, ranges: [{ min: 2, max: 9 }] }",
      "- notion: inconnue",
      "  objective: Autre.",
      '  statement: "Calcule {expression}."',
      '  task: { kind: evaluate, expression: "a + 1" }',
      "  parameters: [{ name: a, ranges: [{ min: 1, max: 5 }] }]",
    ].join("\n");
    const preview = await admin.post(
      `/admin/curriculum-io/countries/${id}/exercises/preview`,
      { content },
    );
    expect(preview.status).toBe(200);
    const items = field(preview.json, "items");
    expect(
      Array.isArray(items) && items.map((i) => field(i, "status")),
    ).toEqual(["ok", "unknown_notion"]);
    const applied = await admin.post(
      `/admin/curriculum-io/countries/${id}/exercises/apply`,
      { content },
    );
    expect(field(applied.json, "created")).toBe(1);
    const again = await admin.post(
      `/admin/curriculum-io/countries/${id}/exercises/preview`,
      { content },
    );
    const second = field(again.json, "items");
    expect(Array.isArray(second) && field(second[0], "status")).toBe(
      "duplicate",
    );
    const bad = await admin.post(
      `/admin/curriculum-io/countries/${id}/exercises/preview`,
      { content: "- notion: [" },
    );
    expect(bad.status).toBe(422);
  });
});
