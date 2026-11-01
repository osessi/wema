// Essai réel de la passerelle IA avec la clé OPENROUTER_API_KEY du fichier .env :
// un message court, par chacun des deux branchements, sans aucune donnée d'élève.
import {
  createAiGateway,
  createAiSdkProvider,
  createOpenRouterProvider,
  DEFAULT_ROUTING,
} from "@wema/ai-gateway";
import { loadConfig } from "./config";

const config = loadConfig(process.env);
if (!config.ok || !config.value.OPENROUTER_API_KEY) {
  console.error("OPENROUTER_API_KEY absente du fichier .env.");
  process.exit(1);
}
const apiKey = config.value.OPENROUTER_API_KEY;
const model = process.argv[2] ?? "openrouter/auto";

for (const provider of [
  createOpenRouterProvider({ apiKey, appName: "Wema" }),
  createAiSdkProvider({ apiKey }),
]) {
  const ai = createAiGateway({
    providers: { [provider.name]: provider },
    routing: async () => ({
      ...DEFAULT_ROUTING,
      provider: provider.name,
      tiers: { reasoning: [model], economic: [model] },
    }),
    log: async () => {},
  });
  const result = await ai.generateText({
    task: "nudge.write",
    messages: [
      { role: "user", content: "Réponds seulement : « Bonjour de Wema »." },
    ],
    context: { organizationId: null, learnerId: null },
    maxTokens: 30,
  });
  if (result.ok) {
    const { text, usage, latencyMs } = result.value;
    console.info(
      `${provider.name} · ${result.value.model} · ${latencyMs} ms · ${usage.inputTokens}+${usage.outputTokens} jetons · ${usage.costUsd ?? "?"} $ : ${text.trim()}`,
    );
  } else {
    console.error(
      `${provider.name} : ${result.error.kind} — ${result.error.message}`,
    );
  }
}
