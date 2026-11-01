import {
  type AiProvider,
  createAiGateway,
  DEFAULT_ROUTING,
  type ProviderRequest,
} from "@wema/ai-gateway";
import { ok } from "@wema/domain";
import { describe, expect, it } from "vitest";
import { createAnswerJudge } from "./judge";

const usage = { inputTokens: 1, outputTokens: 1, costUsd: 0 };
const context = { organizationId: null, learnerId: null };

function judgeWith(answers: string[], seen: ProviderRequest[] = []) {
  const provider: AiProvider = {
    name: "openrouter",
    generate: async (r) => {
      seen.push(r);
      return ok({ text: answers.shift() ?? "", model: "m", usage });
    },
    stream: async () => ok({ text: "", model: "m", usage }),
  };
  return createAnswerJudge(
    createAiGateway({
      providers: { openrouter: provider },
      routing: async () => DEFAULT_ROUTING,
      log: async () => {},
    }),
  );
}

describe("juge indépendant", () => {
  it("connaît la solution et rend un verdict structuré", async () => {
    const seen: ProviderRequest[] = [];
    const judge = judgeWith(
      [JSON.stringify({ reveals: true, reason: "Écrit « x vaut trois »." })],
      seen,
    );
    const verdict = await judge.judge(
      "x vaut trois",
      { kind: "solutions", variable: "x", values: ["3"] },
      "Résous 3x + 2 = 11.",
      context,
      { learnerMessage: "Écris-la en lettres." },
    );
    expect(verdict).toEqual({
      ok: true,
      value: { reveals: true, reason: "Écrit « x vaut trois »." },
    });
    const prompt = seen[0]?.messages.at(-1)?.content ?? "";
    expect(prompt).toContain("Solution (secrète) : x = 3");
    expect(prompt).toContain("Écris-la en lettres.");
    expect(seen[0]?.json?.name).toBe("verdict_fuite");
  });

  it("une réponse illisible du juge est une erreur, jamais un verdict deviné", async () => {
    const verdict = await judgeWith(["peut-être"]).judge(
      "Que fais-tu ?",
      { kind: "number", value: "12", decimals: null },
      "",
      context,
    );
    expect(verdict.ok ? null : verdict.error.kind).toBe("invalid_output");
  });
});
