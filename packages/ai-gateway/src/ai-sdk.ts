import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { Result } from "@wema/domain";
import { err, ok } from "@wema/domain";
import {
  APICallError,
  type FinishReason,
  generateText,
  JSONParseError,
  jsonSchema,
  type LanguageModel,
  type ModelMessage,
  NoObjectGeneratedError,
  Output,
  streamText,
  TypeValidationError,
} from "ai";
import { z } from "zod";
import { errorFromStatus } from "./openrouter";
import type {
  AiError,
  AiProvider,
  AiUsage,
  ChatMessage,
  ProviderRequest,
  ProviderResult,
} from "./types";

export interface AiSdkOptions {
  /** Fabrique d'un modèle Vercel AI SDK. Par défaut : OpenRouter, avec les mêmes garanties de confidentialité. */
  model?: (modelId: string, request: ProviderRequest) => LanguageModel;
  apiKey?: string;
  /** Délai par modèle, en millisecondes (en plus de l'échéance globale de la passerelle). */
  timeoutMs?: number;
}

const costSchema = z.object({
  openrouter: z.object({
    usage: z.object({ cost: z.number().optional() }).optional(),
  }),
});

function usageOf(
  usage:
    | { inputTokens?: number | undefined; outputTokens?: number | undefined }
    | undefined,
  metadata: unknown,
): AiUsage {
  const cost = costSchema.safeParse(metadata);
  return {
    inputTokens: usage?.inputTokens ?? 0,
    outputTokens: usage?.outputTokens ?? 0,
    costUsd: cost.success ? (cost.data.openrouter.usage?.cost ?? null) : null,
  };
}

/** Message au format du Vercel AI SDK : les images deviennent des parties `file` (base64, type image/*). */
export function toModelMessage(message: ChatMessage): ModelMessage {
  if (message.role === "user" && message.images && message.images.length > 0) {
    return {
      role: "user",
      content: [
        ...(message.content
          ? [{ type: "text" as const, text: message.content }]
          : []),
        ...message.images.map((image) => ({
          type: "file" as const,
          data: { type: "data" as const, data: image.data },
          mediaType: image.mediaType,
        })),
      ],
    };
  }
  return { role: message.role, content: message.content };
}

/** Délai dépassé ou coupure réseau : seuls cas où réessayer a du sens par défaut. */
function isTransient(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  return (
    e.name === "AbortError" ||
    e.name === "TimeoutError" ||
    (e.name === "TypeError" && /fetch|network|socket/i.test(e.message))
  );
}

export function toError(e: unknown): AiError {
  // Réponse illisible ou hors schéma : réessayer coûterait sans rien garantir.
  if (NoObjectGeneratedError.isInstance(e)) {
    return {
      kind: "invalid_output",
      message: e.message,
      retryable: false,
      usage: usageOf(e.usage, undefined),
    };
  }
  if (TypeValidationError.isInstance(e) || JSONParseError.isInstance(e)) {
    return { kind: "invalid_output", message: e.message, retryable: false };
  }
  if (APICallError.isInstance(e)) {
    return e.statusCode !== undefined
      ? errorFromStatus(e.statusCode, e.message)
      : { kind: "unavailable", message: e.message, retryable: e.isRetryable };
  }
  return {
    kind: "unavailable",
    message: e instanceof Error ? e.message : String(e),
    retryable: isTransient(e),
  };
}

/** Réponse coupée par un filtre de contenu : refusée, jamais un succès vide. */
class FilteredError extends Error {}

function checkFinish(reason: FinishReason): { truncated?: true } {
  if (reason === "content-filter")
    throw new FilteredError("réponse bloquée par un filtre de contenu");
  return reason === "length" ? { truncated: true } : {};
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
  const common = (request: ProviderRequest) => {
    const own = AbortSignal.timeout(timeoutMs);
    return {
      messages: request.messages.map(toModelMessage),
      ...(request.temperature === undefined
        ? {}
        : { temperature: request.temperature }),
      ...(request.maxTokens === undefined
        ? {}
        : { maxOutputTokens: request.maxTokens }),
      abortSignal: request.signal
        ? AbortSignal.any([own, request.signal])
        : own,
      maxRetries: 0,
    };
  };

  /** Essaie les modèles dans l'ordre ; passe au suivant seulement après une erreur passagère. */
  async function withFallback(
    request: ProviderRequest,
    run: (model: LanguageModel, modelId: string) => Promise<ProviderResult>,
    started: () => boolean = () => false,
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
        last =
          e instanceof FilteredError
            ? { kind: "refused", message: e.message, retryable: false }
            : toError(e);
        // Une partie du texte est déjà partie : ni secours ni nouvelle tentative, pour ne rien envoyer deux fois.
        if (started()) return err({ ...last, retryable: false });
        if (!last.retryable || request.signal?.aborted) return err(last);
      }
    }
    return err(last);
  }

  return {
    name: "ai-sdk",

    generate(request) {
      return withFallback(request, async (model, modelId) => {
        if (request.json) {
          const result = await generateText({
            model,
            output: Output.object({
              schema: jsonSchema(request.json.schema),
              name: request.json.name,
            }),
            ...common(request),
          });
          return {
            text: JSON.stringify(result.output),
            model: result.response.modelId || modelId,
            usage: usageOf(result.usage, result.providerMetadata),
            ...checkFinish(result.finishReason),
          };
        }
        const result = await generateText({ model, ...common(request) });
        return {
          text: result.text,
          model: result.response.modelId || modelId,
          usage: usageOf(result.usage, result.providerMetadata),
          ...checkFinish(result.finishReason),
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
            ...checkFinish(await result.finishReason),
          };
        },
        () => sent,
      );
    },
  };
}
