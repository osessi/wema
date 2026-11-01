import {
  type AiGateway,
  type AiProvider,
  createAiGateway,
  createAiSdkProvider,
  createOpenRouterProvider,
  DEFAULT_ROUTING,
  parseAiRouting,
} from "@wema/ai-gateway";
import {
  createAiCallLog,
  createSettingsStore,
  type SqlExecutor,
} from "@wema/db";

export const AI_ROUTING_KEY = "ai_routing";

/** Routage en vigueur : celui des réglages s'il est valide, sinon celui par défaut. */
export async function currentRouting(db: SqlExecutor) {
  const stored = await createSettingsStore(db).get(AI_ROUTING_KEY);
  const parsed = stored === null ? null : parseAiRouting(stored);
  return parsed?.ok ? parsed.value : DEFAULT_ROUTING;
}

/** Passerelle IA du serveur : branchements configurés, routage relu en base, appels journalisés. */
export function createServerAi(
  db: SqlExecutor,
  options: { openRouterKey: string | null; appUrl: string },
): AiGateway {
  const providers: { openrouter?: AiProvider; "ai-sdk"?: AiProvider } = {};
  if (options.openRouterKey) {
    providers.openrouter = createOpenRouterProvider({
      apiKey: options.openRouterKey,
      appName: "Wema",
      appUrl: options.appUrl,
    });
    providers["ai-sdk"] = createAiSdkProvider({
      apiKey: options.openRouterKey,
    });
  }
  const log = createAiCallLog(db);
  return createAiGateway({
    providers,
    routing: () => currentRouting(db),
    log: (entry) => log.append(entry),
  });
}
