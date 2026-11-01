import { DEFAULT_ROUTING } from "@wema/ai-gateway";
import { describe, expect, it } from "vitest";
import { ADMIN, browser, field, testServer, text } from "./test-helpers";

describe("réglages de la passerelle IA", () => {
  it("l'équipe Wema règle le routage ; un routage invalide est refusé", async () => {
    const { app } = await testServer();
    const admin = browser(app);
    await admin.post("/auth/login", ADMIN);
    const current = await admin.get("/admin/ai/routing");
    expect(field(current.json, "routing")).toEqual(DEFAULT_ROUTING);
    const routing = {
      provider: "ai-sdk",
      tiers: {
        reasoning: ["anthropic/claude-x"],
        economic: ["deepseek/deepseek-y"],
      },
      tasks: { "tutor.hint": ["openai/gpt-z"] },
    };
    expect((await admin.put("/admin/ai/routing", routing)).status).toBe(200);
    expect(
      field((await admin.get("/admin/ai/routing")).json, "routing"),
    ).toEqual(routing);
    expect(
      (
        await admin.put("/admin/ai/routing", {
          ...routing,
          tasks: { inconnue: ["a/b"] },
        })
      ).status,
    ).toBe(422);
    expect((await admin.get("/admin/ai/models")).status).toBe(503);
  });

  it("réservé à l'équipe Wema", async () => {
    const { app } = await testServer();
    const admin = browser(app);
    await admin.post("/auth/login", ADMIN);
    const school = text(
      (
        await admin.post("/admin/organizations", {
          name: "École",
          kind: "school",
        })
      ).json,
      "id",
    );
    const role = text(
      (
        await admin.post(`/admin/organizations/${school}/roles`, {
          name: "Direction",
          permissions: ["members.manage"],
        })
      ).json,
      "id",
    );
    await admin.post(`/admin/organizations/${school}/members`, {
      displayName: "Direction",
      roleId: role,
      login: {
        kind: "email",
        email: "direction@example.test",
        password: "mot-de-passe-direction",
      },
    });
    const director = browser(app);
    await director.post("/auth/login", {
      email: "direction@example.test",
      password: "mot-de-passe-direction",
    });
    expect((await director.get("/admin/ai/routing")).status).toBe(403);
    expect((await director.get("/admin/ai/usage")).status).toBe(403);
  });

  it("chaque appel est journalisé et la synthèse donne les coûts par tâche", async () => {
    const { app, ai } = await testServer();
    const context = { organizationId: null, learnerId: null };
    await ai.generateText({
      task: "tutor.reply",
      messages: [{ role: "user", content: "Bonjour" }],
      context,
    });
    await ai.generateText({
      task: "tutor.reply",
      messages: [{ role: "user", content: "Encore" }],
      context,
    });
    await ai.generateText({
      task: "nudge.write",
      messages: [{ role: "user", content: "Relance" }],
      context,
    });
    const admin = browser(app);
    await admin.post("/auth/login", ADMIN);
    const usage = await admin.get("/admin/ai/usage?groupBy=task");
    expect(field(usage.json, "totalCostUsd")).toBeCloseTo(0.003, 6);
    const rows = field(usage.json, "rows");
    expect(
      Array.isArray(rows) &&
        rows.map((r: unknown) => [field(r, "key"), field(r, "calls")]),
    ).toEqual([
      ["tutor.reply", 2],
      ["nudge.write", 1],
    ]);
  });
});
