import type { Result } from "@wema/domain";
import { err, ok } from "@wema/domain";
import { z } from "zod";
import { scrubMessages } from "./privacy";
import { type AiRouting, modelsFor } from "./routing";
import type {
  AiError,
  AiProvider,
  AiRequest,
  AiTextResult,
  ProviderName,
  ProviderRequest,
  ProviderResult,
} from "./types";

/** Trace d'un appel, réussi ou non, pour le journal des coûts. */
export interface AiCallEntry {
  task: string;
  provider: ProviderName;
  /** Modèle qui a répondu, ou le premier demandé en cas d'échec. */
  model: string;
  organizationId: string | null;
  learnerId: string | null;
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
  latencyMs: number;
  status: "ok" | "error";
  errorKind: string | null;
}

export interface AiGatewayOptions {
  providers: Partial<Record<ProviderName, AiProvider>>;
  /** Routage en vigueur, relu à chaque appel (il peut changer sans redémarrage). */
  routing: () => Promise<AiRouting>;
  log: (entry: AiCallEntry) => Promise<void>;
  now?: () => number;
  /** Attente avant la nouvelle tentative, en millisecondes. */
  retryDelayMs?: number;
}

/**
 * Porte unique vers l'IA (AGENTS.md, règle 5) : choisit le fournisseur et les
 * modèles de la tâche, masque les données personnelles, réessaie une fois une
 * erreur passagère, et journalise chaque appel avec son coût.
 */
export function createAiGateway(options: AiGatewayOptions) {
  const now = options.now ?? (() => performance.now());
  const retryDelay = options.retryDelayMs ?? 800;

  async function run(
    request: AiRequest,
    extra: Pick<ProviderRequest, "json">,
    call: (
      provider: AiProvider,
      req: ProviderRequest,
    ) => Promise<Result<ProviderResult, AiError>>,
  ): Promise<Result<AiTextResult, AiError>> {
    const routing = await options.routing();
    const provider = options.providers[routing.provider];
    const models = modelsFor(routing, request.task);
    const started = now();
    const entry = (r: Partial<AiCallEntry>): AiCallEntry => ({
      task: request.task,
      provider: routing.provider,
      model: models[0] ?? "",
      organizationId: request.context.organizationId,
      learnerId: request.context.learnerId,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: null,
      latencyMs: Math.round(now() - started),
      status: "error",
      errorKind: null,
      ...r,
    });
    if (!provider) {
      const error: AiError = {
        kind: "misconfigured",
        message: `fournisseur ${routing.provider} non configuré`,
        retryable: false,
      };
      await options.log(entry({ errorKind: error.kind }));
      return err(error);
    }
    const providerRequest: ProviderRequest = {
      models,
      messages: scrubMessages(request.messages),
      ...(request.temperature === undefined
        ? {}
        : { temperature: request.temperature }),
      ...(request.maxTokens === undefined
        ? {}
        : { maxTokens: request.maxTokens }),
      ...extra,
    };

    let result = await call(provider, providerRequest);
    if (!result.ok && result.error.retryable) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
      result = await call(provider, providerRequest);
    }
    if (!result.ok) {
      await options.log(entry({ errorKind: result.error.kind }));
      return result;
    }
    const value = result.value;
    const latencyMs = Math.round(now() - started);
    await options.log(
      entry({
        model: value.model,
        inputTokens: value.usage.inputTokens,
        outputTokens: value.usage.outputTokens,
        costUsd: value.usage.costUsd,
        latencyMs,
        status: "ok",
      }),
    );
    return ok({
      text: value.text,
      model: value.model,
      provider: provider.name,
      usage: value.usage,
      latencyMs,
    });
  }

  return {
    generateText: (request: AiRequest) =>
      run(request, {}, (p, r) => p.generate(r)),

    /** Texte transmis au fil de l'eau par `onDelta`, puis le résultat complet. */
    streamText: (request: AiRequest, onDelta: (delta: string) => void) =>
      run(request, {}, (p, r) => p.stream(r, onDelta)),

    /**
     * Réponse structurée : le fournisseur reçoit le schéma JSON, puis la
     * réponse est contrôlée par le schéma Zod. Une réponse non conforme est
     * une erreur `invalid_output`, jamais une donnée devinée.
     */
    async generateObject<T>(
      request: AiRequest,
      schema: z.ZodType<T>,
      name = "reponse",
    ): Promise<Result<{ object: T } & AiTextResult, AiError>> {
      const jsonSchema = z.toJSONSchema(schema, { target: "draft-7" });
      const result = await run(
        request,
        { json: { name, schema: jsonSchema } },
        (p, r) => p.generate(r),
      );
      if (!result.ok) return result;
      let raw: unknown;
      try {
        raw = JSON.parse(result.value.text);
      } catch {
        return err({
          kind: "invalid_output",
          message: "réponse qui n'est pas du JSON",
          retryable: false,
        });
      }
      const parsed = schema.safeParse(raw);
      if (!parsed.success) {
        return err({
          kind: "invalid_output",
          message: z.prettifyError(parsed.error),
          retryable: false,
        });
      }
      return ok({ ...result.value, object: parsed.data });
    },
  };
}

export type AiGateway = ReturnType<typeof createAiGateway>;
