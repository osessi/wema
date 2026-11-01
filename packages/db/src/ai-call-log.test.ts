import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { createAiCallLog, fromPglite, migrate } from "./index";

describe("journal des appels d'IA", () => {
  it("additionne coûts et jetons par tâche, et ne se modifie pas", async () => {
    const db = fromPglite(new PGlite());
    await migrate(db);
    const log = createAiCallLog(db);
    const call = {
      provider: "openrouter",
      model: "anthropic/claude-x",
      organizationId: null,
      learnerId: null,
      inputTokens: 100,
      outputTokens: 20,
      latencyMs: 900,
      errorKind: null,
    };
    await log.append({
      ...call,
      task: "tutor.reply",
      costUsd: 0.002,
      status: "ok",
    });
    await log.append({
      ...call,
      task: "tutor.reply",
      costUsd: 0.003,
      status: "ok",
    });
    await log.append({
      ...call,
      task: "nudge.write",
      costUsd: null,
      status: "error",
      errorKind: "rate_limited",
    });
    const rows = await log.usage({
      from: new Date(Date.now() - 60_000),
      to: new Date(Date.now() + 60_000),
      groupBy: "task",
    });
    expect(rows).toEqual([
      {
        key: "tutor.reply",
        calls: 2,
        errors: 0,
        inputTokens: 200,
        outputTokens: 40,
        costUsd: 0.005,
        avgLatencyMs: 900,
      },
      {
        key: "nudge.write",
        calls: 1,
        errors: 1,
        inputTokens: 100,
        outputTokens: 20,
        costUsd: 0,
        avgLatencyMs: 900,
      },
    ]);
    await expect(db.exec("DELETE FROM ai_calls")).rejects.toThrow(/ajout seul/);
  });
});
