import type { Result } from "@wema/domain";
import { err, ok } from "@wema/domain";
import { z } from "zod";
import type {
  AiError,
  AiProvider,
  AiUsage,
  ProviderRequest,
  ProviderResult,
} from "./types";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

export interface OpenRouterOptions {
  apiKey: string;
  /** Nom et adresse de l'application, pour l'attribution chez OpenRouter. */
  appName?: string;
  appUrl?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

const usageSchema = z
  .object({
    prompt_tokens: z.number().optional(),
    completion_tokens: z.number().optional(),
    cost: z.number().optional(),
  })
  .partial();

const errorSchema = z.object({
  error: z.object({
    code: z.union([z.number(), z.string()]).optional(),
    message: z.string().optional(),
  }),
});

const completionSchema = z.object({
  model: z.string().optional(),
  choices: z
    .array(
      z.object({
        message: z.object({ content: z.string().nullable().optional() }),
      }),
    )
    .min(1),
  usage: usageSchema.optional(),
});

const chunkSchema = z.object({
  model: z.string().optional(),
  choices: z
    .array(
      z.object({
        delta: z
          .object({ content: z.string().nullable().optional() })
          .optional(),
      }),
    )
    .optional(),
  usage: usageSchema.optional(),
  error: z
    .object({
      code: z.union([z.number(), z.string()]).optional(),
      message: z.string().optional(),
    })
    .optional(),
});

function toUsage(usage: z.infer<typeof usageSchema> | undefined): AiUsage {
  return {
    inputTokens: usage?.prompt_tokens ?? 0,
    outputTokens: usage?.completion_tokens ?? 0,
    costUsd: usage?.cost ?? null,
  };
}

/** Erreur typée d'après le code HTTP (ou le code d'erreur renvoyé dans le corps). */
export function errorFromStatus(status: number, message: string): AiError {
  if (status === 429) return { kind: "rate_limited", message, retryable: true };
  if (status === 402 || status === 403)
    return { kind: "refused", message, retryable: false };
  if ([408, 500, 502, 503, 504, 524, 529].includes(status))
    return { kind: "unavailable", message, retryable: true };
  return { kind: "misconfigured", message, retryable: false };
}

/**
 * Branchement OpenRouter, en HTTP direct. Chaque appel exige des fournisseurs
 * qui ne collectent ni ne conservent les données (élèves mineurs).
 */
export function createOpenRouterProvider(
  options: OpenRouterOptions,
): AiProvider {
  const fetchImpl = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? 60_000;

  const body = (request: ProviderRequest, stream: boolean) => ({
    model: request.models[0],
    ...(request.models.length > 1 ? { models: request.models } : {}),
    messages: request.messages,
    ...(request.temperature === undefined
      ? {}
      : { temperature: request.temperature }),
    ...(request.maxTokens === undefined
      ? {}
      : { max_completion_tokens: request.maxTokens }),
    provider: {
      data_collection: "deny",
      zdr: true,
      // Avec un schéma imposé, seulement les fournisseurs qui savent le respecter.
      ...(request.json ? { require_parameters: true } : {}),
    },
    ...(request.json
      ? {
          response_format: {
            type: "json_schema",
            json_schema: {
              name: request.json.name,
              strict: true,
              schema: request.json.schema,
            },
          },
        }
      : {}),
    ...(stream ? { stream: true } : {}),
  });

  const send = async (
    request: ProviderRequest,
    stream: boolean,
  ): Promise<Result<Response, AiError>> => {
    try {
      const res = await fetchImpl(ENDPOINT, {
        method: "POST",
        headers: {
          authorization: `Bearer ${options.apiKey}`,
          "content-type": "application/json",
          ...(options.appUrl ? { "HTTP-Referer": options.appUrl } : {}),
          ...(options.appName ? { "X-OpenRouter-Title": options.appName } : {}),
        },
        body: JSON.stringify(body(request, stream)),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.ok) return ok(res);
      const parsed = errorSchema.safeParse(await res.json().catch(() => null));
      return err(
        errorFromStatus(
          res.status,
          parsed.success
            ? (parsed.data.error.message ?? "")
            : `HTTP ${res.status}`,
        ),
      );
    } catch (e) {
      return err({
        kind: "unavailable",
        message: e instanceof Error ? e.message : String(e),
        retryable: true,
      });
    }
  };

  return {
    name: "openrouter",

    async generate(request): Promise<Result<ProviderResult, AiError>> {
      const res = await send(request, false);
      if (!res.ok) return res;
      const json: unknown = await res.value.json().catch(() => null);
      // Une erreur peut arriver avec un statut 200.
      const failure = errorSchema.safeParse(json);
      if (failure.success) {
        const code = Number(failure.data.error.code);
        return err(
          errorFromStatus(
            Number.isFinite(code) ? code : 502,
            failure.data.error.message ?? "erreur du fournisseur",
          ),
        );
      }
      const parsed = completionSchema.safeParse(json);
      if (!parsed.success)
        return err({
          kind: "invalid_output",
          message: "réponse illisible d'OpenRouter",
          retryable: false,
        });
      return ok({
        text: parsed.data.choices[0]?.message.content ?? "",
        model: parsed.data.model ?? request.models[0] ?? "",
        usage: toUsage(parsed.data.usage),
      });
    },

    async stream(request, onDelta): Promise<Result<ProviderResult, AiError>> {
      const res = await send(request, true);
      if (!res.ok) return res;
      const reader = res.value.body?.getReader();
      if (!reader)
        return err({
          kind: "invalid_output",
          message: "flux vide",
          retryable: false,
        });
      const decoder = new TextDecoder();
      let buffer = "";
      let text = "";
      let model = request.models[0] ?? "";
      let usage: AiUsage = { inputTokens: 0, outputTokens: 0, costUsd: null };
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            // Les commentaires SSE (« : OPENROUTER PROCESSING ») maintiennent la connexion.
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (data === "[DONE]") continue;
            let raw: unknown;
            try {
              raw = JSON.parse(data);
            } catch {
              continue;
            }
            const chunk = chunkSchema.safeParse(raw);
            if (!chunk.success) continue;
            if (chunk.data.error) {
              const code = Number(chunk.data.error.code);
              const error = errorFromStatus(
                Number.isFinite(code) ? code : 502,
                chunk.data.error.message ?? "erreur pendant le flux",
              );
              // Une partie du texte est déjà partie : on ne recommence pas, pour ne rien envoyer deux fois.
              return err({
                ...error,
                retryable: error.retryable && text === "",
              });
            }
            if (chunk.data.model) model = chunk.data.model;
            const delta = chunk.data.choices?.[0]?.delta?.content;
            if (delta) {
              text += delta;
              onDelta(delta);
            }
            if (chunk.data.usage) usage = toUsage(chunk.data.usage);
          }
        }
      } catch (e) {
        return err({
          kind: "unavailable",
          message: e instanceof Error ? e.message : String(e),
          retryable: false,
        });
      }
      return ok({ text, model, usage });
    },
  };
}
