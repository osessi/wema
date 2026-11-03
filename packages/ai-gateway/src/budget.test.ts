import { ok } from "@wema/domain";
import { describe, expect, it } from "vitest";
import {
  type AiCallEntry,
  type AiProvider,
  createAiGateway,
  DEFAULT_ROUTING,
  isEssentialTask,
  spendingLevel,
  spendingVerdict,
} from "./index";

const usage = { inputTokens: 1, outputTokens: 1, costUsd: 0.001 };
const context = { organizationId: "org-1", learnerId: null };

function setup(guard: () => Promise<{ block: boolean }>) {
  const log: AiCallEntry[] = [];
  let providerCalls = 0;
  const provider: AiProvider = {
    name: "openrouter",
    generate: async () => {
      providerCalls++;
      return ok({ text: "bonjour", model: "m", usage });
    },
    stream: async () => ok({ text: "bonjour", model: "m", usage }),
  };
  const g = createAiGateway({
    providers: { openrouter: provider },
    routing: async () => DEFAULT_ROUTING,
    log: async (e) => {
      log.push(e);
    },
    retryDelayMs: 0,
    spendingGuard: guard,
  });
  return { g, log, calls: () => providerCalls };
}

const message = [{ role: "user" as const, content: "x" }];

describe("plafonds de dépense", () => {
  it("niveaux : sous l'alerte, alerte, plafond atteint, pas de plafond", () => {
    const cap = { monthlyUsd: 10, alertRatio: 0.8 };
    expect(spendingLevel(5, cap)).toBe("ok");
    expect(spendingLevel(8, cap)).toBe("warning");
    expect(spendingLevel(10, cap)).toBe("blocked");
    expect(spendingLevel(1000, null)).toBe("ok");
  });

  it("bloque une tâche non essentielle au-delà d'un plafond, jamais une tâche essentielle", () => {
    const over = {
      spent: { global: 3, organization: 12 },
      caps: {
        global: { monthlyUsd: 100, alertRatio: 0.8 },
        organization: { monthlyUsd: 10, alertRatio: 0.8 },
      },
    };
    expect(spendingVerdict({ task: "nudge.write", ...over }).block).toBe(true);
    expect(spendingVerdict({ task: "tutor.reply", ...over }).block).toBe(false);
    const verdict = spendingVerdict({ task: "exercise.propose", ...over });
    expect(verdict.scopes).toEqual([
      { scope: "global", level: "ok", spentUsd: 3, capUsd: 100 },
      { scope: "organization", level: "blocked", spentUsd: 12, capUsd: 10 },
    ]);
    expect(
      spendingVerdict({
        task: "nudge.write",
        spent: { global: 3, organization: null },
        caps: { global: null, organization: null },
      }).block,
    ).toBe(false);
    expect(isEssentialTask("copy.review")).toBe(true);
    expect(isEssentialTask("exercise.propose")).toBe(false);
  });

  it("la passerelle refuse proprement un appel bloqué, sans contacter le fournisseur, et le journalise", async () => {
    const { g, log, calls } = setup(async () => ({ block: true }));
    const r = await g.generateText({
      task: "nudge.write",
      messages: message,
      context,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("budget_exceeded");
    expect(calls()).toBe(0);
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({
      task: "nudge.write",
      status: "error",
      errorKind: "budget_exceeded",
      costUsd: null,
    });
  });

  it("un appel essentiel passe même si le contrôle demande un blocage", async () => {
    const { g, calls } = setup(async () => ({ block: true }));
    const r = await g.generateText({
      task: "tutor.reply",
      messages: message,
      context,
    });
    expect(r.ok).toBe(true);
    expect(calls()).toBe(1);
  });

  it("un contrôle en panne laisse passer l'appel", async () => {
    const { g, calls } = setup(async () => {
      throw new Error("base indisponible");
    });
    const r = await g.generateText({
      task: "nudge.write",
      messages: message,
      context,
    });
    expect(r.ok).toBe(true);
    expect(calls()).toBe(1);
  });
});
