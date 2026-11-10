import type { Result } from "@wema/domain";
import { err, ok } from "@wema/domain";
import { z } from "zod";
import { isEssentialTask, type SpendingGuard } from "./budget";
import { scrubMessages } from "./privacy";
import { type AiRouting, modelsFor } from "./routing";
import type {
  AiError,
  AiModelInfo,
  AiProvider,
  AiRequest,
  AiTextResult,
  ProviderName,
  ProviderRequest,
  ProviderResult,
} from "./types";

/** Trace d'une tentative d'appel, réussie ou non, pour le journal des coûts. */
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
  /** Échéance globale d'un appel (tentatives et secours compris), en millisecondes. */
  timeoutMs?: number;
  /**
   * Plafonds de dépense : consulté avant chaque appel. Un appel non essentiel
   * est refusé (`budget_exceeded`) si le contrôle le demande ; un appel
   * essentiel ne l'est jamais. Un contrôle en panne laisse passer l'appel.
   */
  spendingGuard?: SpendingGuard;
}

/** Contrôle d'une réponse avant de la déclarer réussie (ex. schéma d'une sortie structurée). */
type Check = (value: ProviderResult) => AiError | null;

/**
 * Porte unique vers l'IA (AGENTS.md, règle 5) : choisit le fournisseur et les
 * modèles de la tâche, masque les données personnelles, réessaie une fois une
 * erreur passagère, et journalise chaque tentative avec son coût.
 */
export function createAiGateway(options: AiGatewayOptions) {
  const now = options.now ?? (() => performance.now());
  const retryDelay = options.retryDelayMs ?? 800;
  const timeoutMs = options.timeoutMs ?? 90_000;

  /** Un journal indisponible ne doit pas faire perdre une réponse déjà payée. */
  async function safeLog(entry: AiCallEntry): Promise<void> {
    try {
      await options.log(entry);
    } catch {
      // Ni le contenu ni l'erreur brute (elle peut citer des valeurs) : seulement le fait.
      console.error(
        `journal IA : échec d'écriture (tâche ${entry.task}, statut ${entry.status})`,
      );
    }
  }

  async function run(
    request: AiRequest,
    extra: Pick<ProviderRequest, "json">,
    call: (
      provider: AiProvider,
      req: ProviderRequest,
    ) => Promise<Result<ProviderResult, AiError>>,
    check: Check = () => null,
  ): Promise<Result<AiTextResult, AiError>> {
    const routing = await options.routing();
    const provider = options.providers[routing.provider];
    const models = modelsFor(routing, request.task);
    const entry = (started: number, r: Partial<AiCallEntry>): AiCallEntry => ({
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
    if (options.spendingGuard) {
      let block = false;
      try {
        ({ block } = await options.spendingGuard(
          request.task,
          request.context,
        ));
      } catch {
        console.error(
          `plafonds IA : contrôle indisponible (tâche ${request.task}), appel autorisé`,
        );
      }
      if (block && !isEssentialTask(request.task)) {
        const error: AiError = {
          kind: "budget_exceeded",
          message: "plafond de dépense atteint : appel non essentiel bloqué",
          retryable: false,
        };
        await safeLog(entry(now(), { errorKind: error.kind, latencyMs: 0 }));
        return err(error);
      }
    }
    if (!provider) {
      const error: AiError = {
        kind: "misconfigured",
        message: `fournisseur ${routing.provider} non configuré`,
        retryable: false,
      };
      await safeLog(entry(now(), { errorKind: error.kind }));
      return err(error);
    }
    const signal = AbortSignal.timeout(timeoutMs);
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
      signal,
    };

    /** Une tentative, journalisée quelle que soit son issue. */
    const attempt = async (): Promise<{
      result: Result<ProviderResult, AiError>;
      latencyMs: number;
    }> => {
      const started = now();
      const raw = await call(provider, providerRequest);
      const failure = raw.ok ? check(raw.value) : null;
      const result: Result<ProviderResult, AiError> =
        raw.ok && failure ? err({ ...failure, usage: raw.value.usage }) : raw;
      const latencyMs = Math.round(now() - started);
      if (result.ok) {
        const v = result.value;
        await safeLog(
          entry(started, {
            model: v.model,
            inputTokens: v.usage.inputTokens,
            outputTokens: v.usage.outputTokens,
            costUsd: v.usage.costUsd,
            latencyMs,
            status: "ok",
          }),
        );
      } else {
        const usage = result.error.usage;
        await safeLog(
          entry(started, {
            errorKind: result.error.kind,
            latencyMs,
            ...(usage
              ? {
                  inputTokens: usage.inputTokens,
                  outputTokens: usage.outputTokens,
                  costUsd: usage.costUsd,
                }
              : {}),
          }),
        );
      }
      return { result, latencyMs };
    };

    const started = now();
    let { result } = await attempt();
    if (!result.ok && result.error.retryable && !signal.aborted) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
      if (!signal.aborted) ({ result } = await attempt());
    }
    if (!result.ok) return result;
    const value = result.value;
    return ok({
      text: value.text,
      model: value.model,
      provider: provider.name,
      usage: value.usage,
      latencyMs: Math.round(now() - started),
      ...(value.truncated ? { truncated: true } : {}),
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
     * une erreur `invalid_output` (journalisée comme telle), jamais une donnée devinée.
     */
    async generateObject<T>(
      request: AiRequest,
      schema: z.ZodType<T>,
      name = "reponse",
    ): Promise<Result<{ object: T } & AiTextResult, AiError>> {
      const jsonSchema = z.toJSONSchema(schema, { target: "draft-7" });
      let object: T | undefined;
      const result = await run(
        request,
        { json: { name, schema: jsonSchema } },
        (p, r) => p.generate(r),
        (value) => {
          let raw: unknown;
          try {
            raw = JSON.parse(value.text);
          } catch {
            return {
              kind: "invalid_output",
              message: "réponse qui n'est pas du JSON",
              retryable: false,
            };
          }
          const parsed = schema.safeParse(raw);
          if (!parsed.success) {
            return {
              kind: "invalid_output",
              message: z.prettifyError(parsed.error),
              retryable: false,
            };
          }
          object = parsed.data;
          return null;
        },
      );
      if (!result.ok) return result;
      if (object === undefined) {
        return err({
          kind: "invalid_output",
          message: "réponse vide",
          retryable: false,
        });
      }
      return ok({ ...result.value, object });
    },

    /** Modèles proposés par le fournisseur actif (ou, à défaut, par un fournisseur qui sait les lister). */
    async listModels(): Promise<Result<AiModelInfo[], AiError>> {
      const routing = await options.routing();
      const active = options.providers[routing.provider];
      const lister = active?.listModels
        ? active
        : Object.values(options.providers).find((p) => p?.listModels);
      if (!lister?.listModels) {
        return err({
          kind: "misconfigured",
          message: "aucun fournisseur ne sait lister ses modèles",
          retryable: false,
        });
      }
      return lister.listModels();
    },
  };
}

export type AiGateway = ReturnType<typeof createAiGateway>;
