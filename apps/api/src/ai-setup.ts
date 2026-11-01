import {
  type AiGateway,
  type AiProvider,
  type AiRouting,
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

/**
 * Routage stocké : celui des réglages s'il est valide, sinon celui par défaut,
 * en signalant un réglage stocké devenu invalide (au lieu de le masquer).
 */
export async function storedRouting(db: SqlExecutor): Promise<{
  routing: AiRouting;
  invalid: { path: string; message: string }[] | null;
}> {
  const stored = await createSettingsStore(db).get(AI_ROUTING_KEY);
  if (stored === null) return { routing: DEFAULT_ROUTING, invalid: null };
  const parsed = parseAiRouting(stored);
  return parsed.ok
    ? { routing: parsed.value, invalid: null }
    : { routing: DEFAULT_ROUTING, invalid: parsed.error.issues };
}

/** Routage en vigueur : celui des réglages s'il est valide, sinon celui par défaut. */
export async function currentRouting(db: SqlExecutor): Promise<AiRouting> {
  return (await storedRouting(db)).routing;
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
