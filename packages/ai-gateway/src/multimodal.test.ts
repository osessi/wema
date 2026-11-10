import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import {
  type ChatMessage,
  createAiGateway,
  createAiSdkProvider,
  createOpenRouterProvider,
  DEFAULT_ROUTING,
  isAiImageType,
  type ProviderRequest,
  scrubMessages,
  tierOf,
} from "./index";

// Image fictive : quelques octets suffisent, la passerelle ne la décode pas.
const image = { mediaType: "image/png" as const, data: "iVBORw0KGgo=" };
const withImage: ChatMessage = {
  role: "user",
  content: "Voici ma copie, écris-moi à eleve@exemple.test",
  images: [image],
};

describe("messages avec image", () => {
  it("la tâche de relecture de copie existe, au palier raisonnement", () => {
    expect(tierOf("copy.review")).toBe("reasoning");
    expect(isAiImageType("image/webp")).toBe(true);
    expect(isAiImageType("image/heic")).toBe(false);
  });

  it("le masquage garde l'image et filtre le texte", () => {
    expect(scrubMessages([withImage])).toEqual([
      {
        role: "user",
        content: "Voici ma copie, écris-moi à [e-mail masqué]",
        images: [image],
      },
    ]);
  });

  it("OpenRouter : texte puis image en adresse data:", async () => {
    let sent: unknown = null;
    const provider = createOpenRouterProvider({
      apiKey: "cle-test",
      fetch: async (_url, init) => {
        sent = JSON.parse(typeof init?.body === "string" ? init.body : "null");
        return new Response(
          JSON.stringify({
            model: "m",
            choices: [{ message: { content: "{}" } }],
            usage: { prompt_tokens: 900, completion_tokens: 20, cost: 0.003 },
          }),
          { status: 200 },
        );
      },
    });
    const request: ProviderRequest = {
      models: ["anthropic/claude-haiku-5.5"],
      messages: [{ role: "system", content: "Consigne" }, withImage],
    };
    const result = await provider.generate(request);
    expect(result.ok).toBe(true);
    expect(sent).toMatchObject({
      messages: [
        { role: "system", content: "Consigne" },
        {
          role: "user",
          content: [
            { type: "text", text: withImage.content },
            {
              type: "image_url",
              image_url: { url: "data:image/png;base64,iVBORw0KGgo=" },
            },
          ],
        },
      ],
      provider: { data_collection: "deny", zdr: true },
    });
  });

  it("Vercel AI SDK : l'image devient une partie du message", async () => {
    let prompt: unknown = null;
    const provider = createAiSdkProvider({
      model: () =>
        new MockLanguageModelV4({
          doGenerate: async (options) => {
            prompt = options.prompt;
            return {
              content: [{ type: "text", text: "Lu" }],
              finishReason: { unified: "stop", raw: "stop" },
              usage: {
                inputTokens: {
                  total: 1,
                  noCache: 1,
                  cacheRead: 0,
                  cacheWrite: 0,
                },
                outputTokens: { total: 1, text: 1, reasoning: 0 },
              },
              warnings: [],
            };
          },
        }),
    });
    const result = await provider.generate({
      models: ["m"],
      messages: [withImage],
    });
    expect(result.ok && result.value.text).toBe("Lu");
    expect(prompt).toMatchObject([
      {
        role: "user",
        content: [
          { type: "text", text: withImage.content },
          { type: "file", mediaType: "image/png" },
        ],
      },
    ]);
  });

  it("la passerelle transmet l'image au fournisseur, avec la tâche copy.review", async () => {
    const seen: ProviderRequest[] = [];
    const logged: string[] = [];
    const gateway = createAiGateway({
      providers: {
        openrouter: {
          name: "openrouter",
          generate: async (r) => {
            seen.push(r);
            return {
              ok: true,
              value: {
                text: "ok",
                model: "m",
                usage: { inputTokens: 1, outputTokens: 1, costUsd: 0 },
              },
            };
          },
          stream: async () => ({
            ok: false,
            error: { kind: "unavailable", message: "", retryable: false },
          }),
        },
      },
      routing: async () => DEFAULT_ROUTING,
      log: async (e) => {
        logged.push(e.task);
      },
    });
    await gateway.generateText({
      task: "copy.review",
      messages: [withImage],
      context: { organizationId: null, learnerId: null },
    });
    expect(seen[0]?.messages[0]?.images).toEqual([image]);
    expect(logged).toEqual(["copy.review"]);
  });
});
