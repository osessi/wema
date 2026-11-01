import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { Result } from "@wema/domain";
import { err, ok } from "@wema/domain";
import {
  APICallError,
  generateObject,
  generateText,
  jsonSchema,
  type LanguageModel,
  streamText,
} from "ai";
import { z } from "zod";
import { errorFromStatus } from "./openrouter";
import type {
  AiError,
  AiProvider,
  AiUsage,
  ProviderRequest,
  ProviderResult,
} from "./types";

export interface AiSdkOptions {
  /** Fabrique d'un modèle Vercel AI SDK. Par défaut : OpenRouter, avec les mêmes garanties de confidentialité. */
  model?: (modelId: string, request: ProviderRequest) => LanguageModel;
  apiKey?: string;
  timeoutMs?: number;
}

const costSchema = z.object({
  openrouter: z.object({
    usage: z.object({ cost: z.number().optional() }).optional(),
  }),
});

function usageOf(
  usage: {
    inputTokens?: number | undefined;
    outputTokens?: number | undefined;
  },
  metadata: unknown,
): AiUsage {
  const cost = costSchema.safeParse(metadata);
  return {
    inputTokens: usage.inputTokens ?? 0,
    outputTokens: usage.outputTokens ?? 0,
    costUsd: cost.success ? (cost.data.openrouter.usage?.cost ?? null) : null,
  };
}

function toError(e: unknown): AiError {
  if (APICallError.isInstance(e)) {
    return e.statusCode !== undefined
      ? errorFromStatus(e.statusCode, e.message)
      : { kind: "unavailable", message: e.message, retryable: e.isRetryable };
  }
  return {
    kind: "unavailable",
    message: e instanceof Error ? e.message : String(e),
    retryable: true,
  };
}

/**
 * Branchement Vercel AI SDK : mêmes fonctions que le branchement OpenRouter.
 * Les modèles de secours sont essayés dans l'ordre après une erreur passagère.
 */
export function createAiSdkProvider(options: AiSdkOptions): AiProvider {
  const openrouter = options.apiKey
    ? createOpenRouter({ apiKey: options.apiKey })
    : null;
  const timeoutMs = options.timeoutMs ?? 60_000;
  const modelFor = (
    modelId: string,
    request: ProviderRequest,
  ): LanguageModel | null => {
    if (options.model) return options.model(modelId, request);
    if (!openrouter) return null;
    return openrouter.chat(modelId, {
      provider: {
        data_collection: "deny",
        zdr: true,
        ...(request.json ? { require_parameters: true } : {}),
      },
      usage: { include: true },
    });
  };
  const common = (request: ProviderRequest) => ({
    messages: request.messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    ...(request.temperature === undefined
      ? {}
      : { temperature: request.temperature }),
    ...(request.maxTokens === undefined
      ? {}
      : { maxOutputTokens: request.maxTokens }),
    abortSignal: AbortSignal.timeout(timeoutMs),
    maxRetries: 0,
  });

  /** Essaie les modèles dans l'ordre ; passe au suivant seulement après une erreur passagère. */
  async function withFallback(
    request: ProviderRequest,
    run: (model: LanguageModel, modelId: string) => Promise<ProviderResult>,
    canFallBack: () => boolean = () => true,
  ): Promise<Result<ProviderResult, AiError>> {
    let last: AiError = {
      kind: "misconfigured",
      message: "aucun modèle",
      retryable: false,
    };
    for (const modelId of request.models) {
      const model = modelFor(modelId, request);
      if (!model)
        return err({
          kind: "misconfigured",
          message: "clé du fournisseur absente",
          retryable: false,
        });
      try {
        return ok(await run(model, modelId));
      } catch (e) {
        last = toError(e);
        if (!last.retryable || !canFallBack()) return err(last);
      }
    }
    return err(last);
  }

  return {
    name: "ai-sdk",

    generate(request) {
      return withFallback(request, async (model, modelId) => {
        if (request.json) {
          const result = await generateObject({
            model,
            schema: jsonSchema(request.json.schema),
            schemaName: request.json.name,
            ...common(request),
          });
          return {
            text: JSON.stringify(result.object),
            model: result.response.modelId || modelId,
            usage: usageOf(result.usage, result.providerMetadata),
          };
        }
        const result = await generateText({ model, ...common(request) });
        return {
          text: result.text,
          model: result.response.modelId || modelId,
          usage: usageOf(result.usage, result.providerMetadata),
        };
      });
    },

    stream(request, onDelta) {
      let sent = false;
      return withFallback(
        request,
        async (model, modelId) => {
          let failure: unknown = null;
          const result = streamText({
            model,
            ...common(request),
            onError: ({ error }) => {
              failure = error;
            },
          });
          let text = "";
          for await (const delta of result.textStream) {
            text += delta;
            sent = true;
            onDelta(delta);
          }
          if (failure !== null) throw failure;
          const response = await result.response;
          return {
            text,
            model: response.modelId || modelId,
            usage: usageOf(await result.usage, await result.providerMetadata),
          };
        },
        // Une partie du texte est déjà partie : pas de modèle de secours, pour ne rien envoyer deux fois.
        () => !sent,
      );
    },
  };
}
