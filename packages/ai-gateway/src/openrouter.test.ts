import { describe, expect, it } from "vitest";
import { createOpenRouterProvider, type ProviderRequest } from "./index";

const request: ProviderRequest = {
  models: ["anthropic/claude-x", "deepseek/deepseek-y"],
  messages: [{ role: "user", content: "Bonjour" }],
  temperature: 0.3,
  maxTokens: 200,
};

function fakeFetch(
  response: Response,
  calls: { url: string; init: RequestInit | undefined }[] = [],
): typeof fetch {
  return async (input, init) => {
    calls.push({ url: String(input), init });
    return response;
  };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

function bodyOf(init: RequestInit | undefined): unknown {
  return JSON.parse(typeof init?.body === "string" ? init.body : "null");
}

describe("branchement OpenRouter", () => {
  it("exige la confidentialité, envoie les secours et lit le coût", async () => {
    const calls: { url: string; init: RequestInit | undefined }[] = [];
    const provider = createOpenRouterProvider({
      apiKey: "cle-test",
      appName: "Wema",
      fetch: fakeFetch(
        json({
          model: "deepseek/deepseek-y",
          choices: [{ message: { content: "Salut" } }],
          usage: { prompt_tokens: 10, completion_tokens: 3, cost: 0.0012 },
        }),
        calls,
      ),
    });
    const result = await provider.generate(request);
    expect(result).toEqual({
      ok: true,
      value: {
        text: "Salut",
        model: "deepseek/deepseek-y",
        usage: { inputTokens: 10, outputTokens: 3, costUsd: 0.0012 },
      },
    });
    expect(calls[0]?.url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(bodyOf(calls[0]?.init)).toMatchObject({
      model: "anthropic/claude-x",
      models: ["anthropic/claude-x", "deepseek/deepseek-y"],
      provider: { data_collection: "deny", zdr: true },
      max_completion_tokens: 200,
    });
    expect(new Headers(calls[0]?.init?.headers).get("authorization")).toBe(
      "Bearer cle-test",
    );
  });

  it("demande une sortie structurée stricte, chez les fournisseurs qui la respectent", async () => {
    const calls: { url: string; init: RequestInit | undefined }[] = [];
    const provider = createOpenRouterProvider({
      apiKey: "k",
      fetch: fakeFetch(
        json({ choices: [{ message: { content: "{}" } }] }),
        calls,
      ),
    });
    await provider.generate({
      ...request,
      json: { name: "analyse", schema: { type: "object" } },
    });
    expect(bodyOf(calls[0]?.init)).toMatchObject({
      provider: { require_parameters: true },
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "analyse",
          strict: true,
          schema: { type: "object" },
        },
      },
    });
  });

  it("traduit les erreurs : limite de débit, crédits, erreur dans un corps 200, panne réseau", async () => {
    const kind = async (response: Response | Error) => {
      const provider = createOpenRouterProvider({
        apiKey: "k",
        fetch: async () => {
          if (response instanceof Error) throw response;
          return response;
        },
      });
      const r = await provider.generate(request);
      return r.ok ? null : [r.error.kind, r.error.retryable];
    };
    expect(
      await kind(
        json({ error: { code: 429, message: "Rate limit exceeded" } }, 429),
      ),
    ).toEqual(["rate_limited", true]);
    expect(
      await kind(
        json({ error: { code: 402, message: "Insufficient credits" } }, 402),
      ),
    ).toEqual(["refused", false]);
    expect(
      await kind(json({ error: { code: 401, message: "No auth" } }, 401)),
    ).toEqual(["misconfigured", false]);
    expect(
      await kind(
        json({ error: { code: 502, message: "Provider returned error" } }),
      ),
    ).toEqual(["unavailable", true]);
    expect(await kind(new Error("connexion refusée"))).toEqual([
      "unavailable",
      true,
    ]);
  });

  it("lit un flux SSE, ignore les commentaires et garde l'usage du dernier fragment", async () => {
    const sse = [
      ": OPENROUTER PROCESSING",
      'data: {"model":"anthropic/claude-x","choices":[{"delta":{"content":"Bon"}}]}',
      'data: {"choices":[{"delta":{"content":"jour"}}]}',
      'data: {"choices":[{"delta":{"content":""},"finish_reason":"stop"}],"usage":{"prompt_tokens":4,"completion_tokens":2,"cost":0.0001}}',
      "data: [DONE]",
      "",
    ].join("\n");
    const provider = createOpenRouterProvider({
      apiKey: "k",
      fetch: fakeFetch(
        new Response(sse, { headers: { "content-type": "text/event-stream" } }),
      ),
    });
    const parts: string[] = [];
    const result = await provider.stream(request, (d) => parts.push(d));
    expect(parts).toEqual(["Bon", "jour"]);
    expect(result).toEqual({
      ok: true,
      value: {
        text: "Bonjour",
        model: "anthropic/claude-x",
        usage: { inputTokens: 4, outputTokens: 2, costUsd: 0.0001 },
      },
    });
  });

  it("une erreur au milieu du flux n'est pas réessayée (le début est déjà parti)", async () => {
    const sse = [
      'data: {"choices":[{"delta":{"content":"Début"}}]}',
      'data: {"error":{"code":502,"message":"Provider disconnected"},"choices":[{"delta":{"content":""},"finish_reason":"error"}]}',
      "",
    ].join("\n");
    const provider = createOpenRouterProvider({
      apiKey: "k",
      fetch: fakeFetch(new Response(sse)),
    });
    const result = await provider.stream(request, () => {});
    expect(
      result.ok ? null : [result.error.kind, result.error.retryable],
    ).toEqual(["unavailable", false]);
  });
});
