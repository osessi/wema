import { err, ok } from "@wema/domain";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  type AiCallEntry,
  type AiError,
  type AiProvider,
  type AiRouting,
  createAiGateway,
  DEFAULT_ROUTING,
  modelsFor,
  type ProviderRequest,
  parseAiRouting,
  scrubPersonalData,
} from "./index";

const context = { organizationId: "org-1", learnerId: "eleve-1" };
const usage = { inputTokens: 12, outputTokens: 5, costUsd: 0.0004 };

function fakeProvider(
  answers: (string | AiError)[],
  seen: ProviderRequest[] = [],
): AiProvider {
  const next = () => {
    const answer = answers.shift() ?? "fin";
    return typeof answer === "string"
      ? ok({ text: answer, model: "modele/reel", usage })
      : err(answer);
  };
  return {
    name: "openrouter",
    generate: async (request) => {
      seen.push(request);
      return next();
    },
    stream: async (request, onDelta) => {
      seen.push(request);
      const result = next();
      if (result.ok)
        for (const part of result.value.text.split(" ")) onDelta(part);
      return result;
    },
  };
}

function gateway(provider: AiProvider, routing: AiRouting = DEFAULT_ROUTING) {
  const log: AiCallEntry[] = [];
  const g = createAiGateway({
    providers: { [provider.name]: provider },
    routing: async () => routing,
    log: async (e) => {
      log.push(e);
    },
    retryDelayMs: 0,
  });
  return { g, log };
}

describe("routage", () => {
  it("valide le routage et choisit les modèles d'une tâche", () => {
    const routing = parseAiRouting({
      provider: "ai-sdk",
      tiers: {
        reasoning: ["anthropic/claude-x"],
        economic: ["deepseek/deepseek-y"],
      },
      tasks: { "tutor.hint": ["openai/gpt-z", "anthropic/claude-x"] },
    });
    if (!routing.ok) throw new Error(JSON.stringify(routing.error));
    expect(modelsFor(routing.value, "tutor.reply")).toEqual([
      "anthropic/claude-x",
    ]);
    expect(modelsFor(routing.value, "nudge.write")).toEqual([
      "deepseek/deepseek-y",
    ]);
    expect(modelsFor(routing.value, "tutor.hint")).toEqual([
      "openai/gpt-z",
      "anthropic/claude-x",
    ]);
  });

  it("refuse une tâche inconnue, un modèle mal écrit ou une liste vide", () => {
    expect(
      parseAiRouting({
        ...DEFAULT_ROUTING,
        tasks: { "tache.inconnue": ["a/b"] },
      }).ok,
    ).toBe(false);
    expect(
      parseAiRouting({
        ...DEFAULT_ROUTING,
        tiers: { reasoning: ["mauvais modèle"], economic: ["a/b"] },
      }).ok,
    ).toBe(false);
    expect(
      parseAiRouting({
        ...DEFAULT_ROUTING,
        tiers: { reasoning: [], economic: ["a/b"] },
      }).ok,
    ).toBe(false);
  });
});

describe("masquage des données personnelles", () => {
  it("masque e-mails et numéros, mais pas les calculs", () => {
    expect(
      scrubPersonalData(
        "Écris-moi à eleve.test@example.com ou au +229 01 23 45 67 89",
      ),
    ).toBe("Écris-moi à [e-mail masqué] ou au [numéro masqué]");
    expect(
      scrubPersonalData("3x + 2 = 11, donc x = 3 ; 1 250 000 habitants"),
    ).toBe("3x + 2 = 11, donc x = 3 ; 1 250 000 habitants");
  });
});

describe("passerelle", () => {
  it("envoie les modèles de la tâche, masque les données et journalise le coût", async () => {
    const seen: ProviderRequest[] = [];
    const { g, log } = gateway(fakeProvider(["Bonjour !"], seen));
    const result = await g.generateText({
      task: "tutor.reply",
      messages: [{ role: "user", content: "mon mail : eleve@example.com" }],
      context,
    });
    expect(result.ok && result.value.text).toBe("Bonjour !");
    expect(seen[0]?.models).toEqual(["anthropic/claude-haiku-5.5"]);
    expect(seen[0]?.messages[0]?.content).toBe("mon mail : [e-mail masqué]");
    expect(log).toEqual([
      expect.objectContaining({
        task: "tutor.reply",
        model: "modele/reel",
        costUsd: 0.0004,
        status: "ok",
        learnerId: "eleve-1",
      }),
    ]);
  });

  it("réessaie une fois une erreur passagère, pas une erreur définitive", async () => {
    const busy: AiError = {
      kind: "rate_limited",
      message: "429",
      retryable: true,
    };
    const refused: AiError = {
      kind: "refused",
      message: "402",
      retryable: false,
    };
    const retried = gateway(fakeProvider([busy, "Réussi"]));
    expect(
      (
        await retried.g.generateText({
          task: "nudge.write",
          messages: [],
          context,
        })
      ).ok,
    ).toBe(true);
    const failed = gateway(fakeProvider([refused, "jamais"]));
    const result = await failed.g.generateText({
      task: "nudge.write",
      messages: [],
      context,
    });
    expect(result.ok ? null : result.error.kind).toBe("refused");
    expect(failed.log).toEqual([
      expect.objectContaining({ status: "error", errorKind: "refused" }),
    ]);
  });

  it("signale un fournisseur non configuré sans rien envoyer", async () => {
    const { g, log } = gateway(fakeProvider(["x"]), {
      ...DEFAULT_ROUTING,
      provider: "ai-sdk",
    });
    const result = await g.generateText({
      task: "tutor.reply",
      messages: [],
      context,
    });
    expect(result.ok ? null : result.error.kind).toBe("misconfigured");
    expect(log[0]?.status).toBe("error");
  });

  it("transmet le texte au fil de l'eau", async () => {
    const { g } = gateway(fakeProvider(["un deux trois"]));
    const parts: string[] = [];
    const result = await g.streamText(
      { task: "tutor.reply", messages: [], context },
      (d) => parts.push(d),
    );
    expect(parts).toEqual(["un", "deux", "trois"]);
    expect(result.ok && result.value.usage.costUsd).toBe(0.0004);
  });

  it("réponse structurée : schéma envoyé, réponse contrôlée, jamais devinée", async () => {
    const schema = z.object({ correct: z.boolean(), indice: z.string() });
    const seen: ProviderRequest[] = [];
    const good = gateway(
      fakeProvider(['{"correct":false,"indice":"Regarde le signe."}'], seen),
    );
    const result = await good.g.generateObject(
      { task: "answer.analyze", messages: [], context },
      schema,
      "analyse",
    );
    expect(result.ok && result.value.object).toEqual({
      correct: false,
      indice: "Regarde le signe.",
    });
    expect(seen[0]?.json?.name).toBe("analyse");
    expect(seen[0]?.json?.schema).toMatchObject({
      type: "object",
      required: ["correct", "indice"],
    });

    const bad = gateway(
      fakeProvider(['{"correct":"peut-être"}', "pas du json"]),
    );
    for (let i = 0; i < 2; i++) {
      const r = await bad.g.generateObject(
        { task: "answer.analyze", messages: [], context },
        schema,
      );
      expect(r.ok ? null : r.error.kind).toBe("invalid_output");
    }
  });
});
