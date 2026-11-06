import {
  type AiGateway,
  type AiProvider,
  type AiRouting,
  createAiGateway,
  createAiSdkProvider,
  createOpenRouterProvider,
  DEFAULT_ROUTING,
  parseAiRouting,
  type SpendingGuard,
  spendingVerdict,
} from "@wema/ai-gateway";
import {
  createAiCallLog,
  createAiCostStore,
  createSettingsStore,
  monthStart,
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

/**
 * Plafonds de dépense (mois civil, UTC) : relit la dépense du mois et les
 * plafonds global et de l'organisation, note une alerte la première fois
 * qu'un seuil est franchi, et demande le blocage au-delà du plafond (la
 * passerelle ne bloque que les tâches non essentielles).
 */
export function createSpendingGuard(
  db: SqlExecutor,
  now: () => Date = () => new Date(),
): SpendingGuard {
  return async (task, context) => {
    const costs = createAiCostStore(db);
    const caps = await costs.capsFor(context.organizationId);
    if (!caps.global && !caps.organization) return { block: false };
    const month = monthStart(now());
    const spent = await costs.spentSince(month, context.organizationId);
    const verdict = spendingVerdict({ task, spent, caps });
    for (const s of verdict.scopes) {
      if (s.level === "ok") continue;
      const organizationId =
        s.scope === "organization" ? context.organizationId : null;
      const fresh = await costs.recordAlert({
        organizationId,
        month,
        level: s.level,
        spentUsd: s.spentUsd,
        capUsd: s.capUsd,
      });
      if (fresh)
        console.warn(
          `Plafond IA ${s.scope === "global" ? "global" : "d'une organisation"} : ${s.level === "blocked" ? "atteint, appels non essentiels bloqués" : "seuil d'alerte franchi"} (${s.spentUsd.toFixed(2)} $ sur ${s.capUsd.toFixed(2)} $).`,
        );
    }
    return { block: verdict.block };
  };
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
    spendingGuard: createSpendingGuard(db),
  });
}
