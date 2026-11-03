import type { Result } from "@wema/domain";
import { err, ok } from "@wema/domain";
import { z } from "zod";
import type {
  AiError,
  AiModelInfo,
  AiProvider,
  AiUsage,
  ProviderRequest,
  ProviderResult,
} from "./types";

const BASE = "https://openrouter.ai/api/v1";

export interface OpenRouterOptions {
  apiKey: string;
  /** Nom et adresse de l'application, pour l'attribution chez OpenRouter. */
  appName?: string;
  appUrl?: string;
  /** Délai d'une requête, en millisecondes (en plus de l'échéance globale de la passerelle). */
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

const errorBody = z.object({
  code: z.union([z.number(), z.string()]).optional(),
  message: z.string().optional(),
});
const errorSchema = z.object({ error: errorBody });

const completionSchema = z.object({
  model: z.string().optional(),
  choices: z
    .array(
      z.object({
        message: z.object({ content: z.string().nullable().optional() }),
        finish_reason: z.string().nullable().optional(),
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
        finish_reason: z.string().nullable().optional(),
      }),
    )
    .optional(),
  usage: usageSchema.optional(),
  error: errorBody.optional(),
});

const modelsSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      name: z.string().optional(),
      context_length: z.number().nullable().optional(),
      pricing: z
        .object({
          prompt: z.string().optional(),
          completion: z.string().optional(),
        })
        .partial()
        .optional(),
    }),
  ),
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
  if (status >= 200 && status < 300)
    return { kind: "invalid_output", message, retryable: false };
  return { kind: "misconfigured", message, retryable: false };
}

/** Réponse coupée par un filtre de contenu : refusée, jamais un succès vide. */
const FILTERED: AiError = {
  kind: "refused",
  message: "réponse bloquée par un filtre de contenu",
  retryable: false,
};

/** Délai propre à la requête, combiné à l'échéance globale de la passerelle. */
function deadline(
  timeoutMs: number,
  global: AbortSignal | undefined,
): AbortSignal {
  const own = AbortSignal.timeout(timeoutMs);
  return global ? AbortSignal.any([own, global]) : own;
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
  const headers = {
    authorization: `Bearer ${options.apiKey}`,
    "content-type": "application/json",
    ...(options.appUrl ? { "HTTP-Referer": options.appUrl } : {}),
    ...(options.appName ? { "X-OpenRouter-Title": options.appName } : {}),
  };

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
    // Même comportement que le branchement Vercel AI SDK : l'usage et le coût sont demandés.
    usage: { include: true },
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
      const res = await fetchImpl(`${BASE}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(body(request, stream)),
        signal: deadline(timeoutMs, request.signal),
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

  const codeError = (
    error: z.infer<typeof errorBody>,
    fallback: string,
  ): AiError => {
    const code = Number(error.code);
    return errorFromStatus(
      Number.isFinite(code) ? code : 502,
      error.message ?? fallback,
    );
  };

  return {
    name: "openrouter",

    async generate(request): Promise<Result<ProviderResult, AiError>> {
      const res = await send(request, false);
      if (!res.ok) return res;
      const json: unknown = await res.value.json().catch(() => null);
      // Une erreur peut arriver avec un statut 200.
      const failure = errorSchema.safeParse(json);
      if (failure.success)
        return err(codeError(failure.data.error, "erreur du fournisseur"));
      const parsed = completionSchema.safeParse(json);
      if (!parsed.success) {
        return err({
          kind: "invalid_output",
          message: "réponse illisible d'OpenRouter",
          retryable: false,
        });
      }
      const choice = parsed.data.choices[0];
      const usage = toUsage(parsed.data.usage);
      if (choice?.finish_reason === "content_filter")
        return err({ ...FILTERED, usage });
      return ok({
        text: choice?.message.content ?? "",
        model: parsed.data.model ?? request.models[0] ?? "",
        usage,
        ...(choice?.finish_reason === "length" ? { truncated: true } : {}),
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
      let finish: string | null = null;
      let done = false;

      /** Traite une ligne SSE ; renvoie une erreur si le flux en signale une. */
      const handle = (line: string): AiError | null => {
        // Les commentaires SSE (« : OPENROUTER PROCESSING ») maintiennent la connexion.
        if (!line.startsWith("data:")) return null;
        const data = line.slice(5).trim();
        if (data === "[DONE]") {
          done = true;
          return null;
        }
        let raw: unknown;
        try {
          raw = JSON.parse(data);
        } catch {
          return null;
        }
        const chunk = chunkSchema.safeParse(raw);
        if (!chunk.success) return null;
        if (chunk.data.usage) usage = toUsage(chunk.data.usage);
        if (chunk.data.error) {
          const error = codeError(chunk.data.error, "erreur pendant le flux");
          // Une partie du texte est déjà partie : on ne recommence pas, pour ne rien envoyer deux fois.
          return { ...error, retryable: error.retryable && text === "", usage };
        }
        if (chunk.data.model) model = chunk.data.model;
        const choice = chunk.data.choices?.[0];
        const delta = choice?.delta?.content;
        if (delta) {
          text += delta;
          onDelta(delta);
        }
        if (choice?.finish_reason) finish = choice.finish_reason;
        return null;
      };

      try {
        for (;;) {
          const { done: ended, value } = await reader.read();
          if (ended) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const failure = handle(line);
            if (failure) return err(failure);
          }
        }
        // Dernière ligne sans saut de ligne final.
        const failure = handle(buffer + decoder.decode());
        if (failure) return err(failure);
      } catch (e) {
        return err({
          kind: "unavailable",
          message: e instanceof Error ? e.message : String(e),
          retryable: text === "",
          usage,
        });
      }
      if (finish === "content_filter") return err({ ...FILTERED, usage });
      // Ni [DONE] ni raison de fin : le flux a été coupé, la réponse est incomplète.
      if (!done && finish === null) {
        return err({
          kind: "unavailable",
          message: "flux interrompu avant la fin",
          retryable: text === "",
          usage,
        });
      }
      return ok({
        text,
        model,
        usage,
        ...(finish === "length" ? { truncated: true } : {}),
      });
    },

    async listModels(): Promise<Result<AiModelInfo[], AiError>> {
      try {
        const res = await fetchImpl(`${BASE}/models`, {
          headers: { authorization: headers.authorization },
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok)
          return err(errorFromStatus(res.status, `HTTP ${res.status}`));
        const parsed = modelsSchema.safeParse(
          await res.json().catch(() => null),
        );
        if (!parsed.success) {
          return err({
            kind: "invalid_output",
            message: "liste des modèles illisible",
            retryable: false,
          });
        }
        return ok(
          parsed.data.data.map((m) => ({
            id: m.id,
            name: m.name ?? m.id,
            contextLength: m.context_length ?? null,
            promptPrice: m.pricing?.prompt ?? null,
            completionPrice: m.pricing?.completion ?? null,
          })),
        );
      } catch (e) {
        return err({
          kind: "unavailable",
          message: e instanceof Error ? e.message : String(e),
          retryable: true,
        });
      }
    },
  };
}
