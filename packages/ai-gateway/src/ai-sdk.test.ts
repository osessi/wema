import { APICallError, NoObjectGeneratedError } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { createAiSdkProvider, type ProviderRequest } from "./index";

const usage = {
  inputTokens: { total: 8, noCache: 8, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 3, text: 3, reasoning: 0 },
};
const finishReason = { unified: "stop" as const, raw: "stop" };
const request: ProviderRequest = {
  models: ["premier/modele", "secours/modele"],
  messages: [{ role: "user", content: "Bonjour" }],
};

const textResult = (text: string) => ({
  content: [{ type: "text" as const, text }],
  finishReason,
  usage,
  warnings: [],
  providerMetadata: { openrouter: { usage: { cost: 0.002 } } },
});

describe("branchement Vercel AI SDK", () => {
  it("génère du texte et lit le coût dans les métadonnées d'OpenRouter", async () => {
    const provider = createAiSdkProvider({
      model: () => new MockLanguageModelV4({ doGenerate: textResult("Salut") }),
    });
    const result = await provider.generate(request);
    expect(result).toEqual({
      ok: true,
      value: {
        text: "Salut",
        model: expect.any(String),
        usage: { inputTokens: 8, outputTokens: 3, costUsd: 0.002 },
      },
    });
  });

  it("passe au modèle de secours après une erreur passagère", async () => {
    const tried: string[] = [];
    const provider = createAiSdkProvider({
      model: (id) => {
        tried.push(id);
        return new MockLanguageModelV4({
          modelId: id,
          doGenerate: async () => {
            if (id === "premier/modele") {
              throw new APICallError({
                message: "surchargé",
                url: "u",
                requestBodyValues: {},
                statusCode: 503,
              });
            }
            return textResult("Réponse du secours");
          },
        });
      },
    });
    const result = await provider.generate(request);
    expect(tried).toEqual(["premier/modele", "secours/modele"]);
    expect(result.ok && result.value.text).toBe("Réponse du secours");
  });

  it("ne passe pas au secours après une erreur définitive", async () => {
    const provider = createAiSdkProvider({
      model: (id) =>
        new MockLanguageModelV4({
          modelId: id,
          doGenerate: async () => {
            throw new APICallError({
              message: "crédits épuisés",
              url: "u",
              requestBodyValues: {},
              statusCode: 402,
            });
          },
        }),
    });
    const result = await provider.generate(request);
    expect(result.ok ? null : result.error.kind).toBe("refused");
  });

  it("sortie structurée : renvoie l'objet sous forme de JSON", async () => {
    const provider = createAiSdkProvider({
      model: () =>
        new MockLanguageModelV4({ doGenerate: textResult('{"correct":true}') }),
    });
    const result = await provider.generate({
      ...request,
      json: {
        name: "analyse",
        schema: {
          type: "object",
          properties: { correct: { type: "boolean" } },
        },
      },
    });
    expect(result.ok && JSON.parse(result.value.text)).toEqual({
      correct: true,
    });
  });

  it("transmet le texte au fil de l'eau", async () => {
    const provider = createAiSdkProvider({
      model: () =>
        new MockLanguageModelV4({
          doStream: {
            stream: new ReadableStream({
              start(controller) {
                controller.enqueue({ type: "stream-start", warnings: [] });
                controller.enqueue({ type: "text-start", id: "t" });
                controller.enqueue({
                  type: "text-delta",
                  id: "t",
                  delta: "Bon",
                });
                controller.enqueue({
                  type: "text-delta",
                  id: "t",
                  delta: "jour",
                });
                controller.enqueue({ type: "text-end", id: "t" });
                controller.enqueue({ type: "finish", finishReason, usage });
                controller.close();
              },
            }),
          },
        }),
    });
    const parts: string[] = [];
    const result = await provider.stream(request, (d) => parts.push(d));
    expect(parts).toEqual(["Bon", "jour"]);
    expect(result.ok && result.value.usage.outputTokens).toBe(3);
  });

  it("signale une clé absente", async () => {
    const result = await createAiSdkProvider({}).generate(request);
    expect(result.ok ? null : result.error.kind).toBe("misconfigured");
  });

  it("une erreur en plein flux n'est ni réessayée ni passée au secours (pas de texte en double)", async () => {
    const tried: string[] = [];
    const provider = createAiSdkProvider({
      model: (id) => {
        tried.push(id);
        return new MockLanguageModelV4({
          modelId: id,
          doStream: {
            stream: new ReadableStream({
              start(controller) {
                controller.enqueue({ type: "stream-start", warnings: [] });
                controller.enqueue({ type: "text-start", id: "t" });
                controller.enqueue({
                  type: "text-delta",
                  id: "t",
                  delta: "Bonjour ",
                });
                controller.enqueue({
                  type: "error",
                  error: new APICallError({
                    message: "coupé",
                    url: "u",
                    requestBodyValues: {},
                    statusCode: 503,
                  }),
                });
                controller.close();
              },
            }),
          },
        });
      },
    });
    const parts: string[] = [];
    const result = await provider.stream(request, (d) => parts.push(d));
    expect(parts).toEqual(["Bonjour "]);
    expect(tried).toEqual(["premier/modele"]);
    expect(result.ok ? null : result.error.retryable).toBe(false);
  });

  it("une sortie non conforme est invalid_output, sans secours ni nouvelle tentative", async () => {
    const tried: string[] = [];
    const provider = createAiSdkProvider({
      model: (id) => {
        tried.push(id);
        return new MockLanguageModelV4({
          modelId: id,
          doGenerate: async () => {
            throw new NoObjectGeneratedError({
              message: "hors schéma",
              text: "{}",
              response: { id: "r", timestamp: new Date(), modelId: id },
              usage: {
                inputTokens: 3,
                inputTokenDetails: {
                  noCacheTokens: 3,
                  cacheReadTokens: 0,
                  cacheWriteTokens: 0,
                },
                outputTokens: 2,
                outputTokenDetails: { textTokens: 2, reasoningTokens: 0 },
                totalTokens: 5,
              },
              finishReason: "stop",
            });
          },
        });
      },
    });
    const result = await provider.generate({
      ...request,
      json: { name: "a", schema: { type: "object" } },
    });
    expect(
      result.ok ? null : [result.error.kind, result.error.retryable],
    ).toEqual(["invalid_output", false]);
    expect(tried).toEqual(["premier/modele"]);
  });
});
