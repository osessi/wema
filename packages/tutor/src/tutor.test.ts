import {
  type AiProvider,
  createAiGateway,
  DEFAULT_ROUTING,
  type ProviderRequest,
} from "@wema/ai-gateway";
import { asMisconceptionId, ok } from "@wema/domain";
import { describe, expect, it } from "vitest";
import {
  createTutor,
  SAFE_FALLBACK,
  systemPrompt,
  type TutorContext,
} from "./index";

const context = { organizationId: null, learnerId: null };
const usage = { inputTokens: 1, outputTokens: 1, costUsd: 0 };
const signe = asMisconceptionId("00000000-0000-4000-8000-0000000000a1");

/** Faux fournisseur : renvoie les réponses prévues, dans l'ordre, et garde les requêtes. */
function scripted(answers: string[], seen: ProviderRequest[] = []) {
  const provider: AiProvider = {
    name: "openrouter",
    generate: async (r) => {
      seen.push(r);
      return ok({ text: answers.shift() ?? "", model: "m", usage });
    },
    stream: async (r, onDelta) => {
      seen.push(r);
      const text = answers.shift() ?? "";
      for (const w of text.split(" ")) onDelta(`${w} `);
      return ok({ text, model: "m", usage });
    },
  };
  return createTutor(
    createAiGateway({
      providers: { openrouter: provider },
      routing: async () => DEFAULT_ROUTING,
      log: async () => {},
    }),
  );
}

const ctx = (overrides: Partial<TutorContext> = {}): TutorContext => ({
  mode: "exercise_help",
  subjectName: "Mathématiques",
  subjectInstructions: "",
  notion: {
    name: "Équations du premier degré",
    description: "Résoudre ax + b = c.",
  },
  misconceptions: [
    { id: signe, description: "Change le signe sans opérer des deux côtés." },
  ],
  learner: {
    status: "needs_work",
    activeMisconceptions: ["Change le signe sans opérer des deux côtés."],
  },
  exercise: {
    statement: "Résous 3x + 2 = 11.",
    steps: [],
    answer: { kind: "solutions", variable: "x", values: ["3"] },
  },
  hintLevel: 0,
  ...overrides,
});

describe("consigne du prof IA", () => {
  it("ne contient jamais la réponse attendue, ni de donnée personnelle", () => {
    const prompt = systemPrompt(ctx());
    expect(prompt).toContain("Résous 3x + 2 = 11.");
    expect(prompt).not.toMatch(/x\s*=\s*3/);
    expect(prompt).toContain("JAMAIS la réponse finale");
  });

  it("dépend du mode et des consignes de la matière, sans rien de figé sur les maths", () => {
    const teach = systemPrompt(
      ctx({
        mode: "teach_back",
        exercise: null,
        subjectName: "Histoire",
        subjectInstructions: "Cite des dates.",
      }),
    );
    expect(teach).toContain("élève qui ne connaît pas la notion");
    expect(teach).toContain("Matière : Histoire.");
    expect(teach).toContain("Cite des dates.");
  });
});

describe("réponse contrôlée", () => {
  it("laisse passer une relance sans la solution", async () => {
    const tutor = scripted(["Que fais-tu pour isoler 3x ?"]);
    const reply = await tutor.reply(
      ctx(),
      [{ role: "learner", content: "Je bloque." }],
      context,
    );
    expect(reply).toEqual({
      ok: true,
      value: { text: "Que fais-tu pour isoler 3x ?", guarded: false },
    });
  });

  it("régénère une réponse qui donne la solution, avec une consigne renforcée", async () => {
    const seen: ProviderRequest[] = [];
    const tutor = scripted(
      ["Facile : x = 3.", "Retire 2 des deux côtés : qu'obtiens-tu ?"],
      seen,
    );
    const reply = await tutor.reply(
      ctx(),
      [{ role: "learner", content: "Donne-moi la réponse." }],
      context,
    );
    expect(reply).toEqual({
      ok: true,
      value: {
        text: "Retire 2 des deux côtés : qu'obtiens-tu ?",
        guarded: true,
      },
    });
    expect(seen[1]?.messages.at(-1)?.content).toContain("ATTENTION");
  });

  it("remplace par une relance sûre si le prof IA insiste à donner la solution", async () => {
    const tutor = scripted(["x = 3", "La réponse est 3."]);
    const reply = await tutor.reply(
      ctx(),
      [{ role: "learner", content: "Allez, dis-moi." }],
      context,
    );
    expect(reply).toEqual({
      ok: true,
      value: { text: SAFE_FALLBACK, guarded: true },
    });
  });

  it("sans solution à protéger, la réponse arrive au fil de l'eau", async () => {
    const tutor = scripted(["Imagine une balance en équilibre ?"]);
    const parts: string[] = [];
    const reply = await tutor.reply(
      ctx({ mode: "course_question", exercise: null }),
      [{ role: "learner", content: "C'est quoi une équation ?" }],
      context,
      (d) => parts.push(d),
    );
    expect(parts.length).toBeGreaterThan(1);
    expect(reply.ok && reply.value.guarded).toBe(false);
  });
});

describe("indices et analyses", () => {
  it("monte d'un niveau d'indice à chaque demande, jusqu'à 3", async () => {
    const tutor = scripted([
      "Que cherche-t-on ?",
      "Pense à faire la même opération des deux côtés ?",
    ]);
    const first = await tutor.hint(ctx(), [], context);
    expect(first.ok && first.value.level).toBe(1);
    const third = await tutor.hint(ctx({ hintLevel: 3 }), [], context);
    expect(third.ok && third.value.level).toBe(3);
  });

  it("retient une idée fausse seulement si elle est connue et la confiance suffisante", async () => {
    const tutor = scripted([
      JSON.stringify({ misconceptionId: signe, confidence: 0.9 }),
      JSON.stringify({ misconceptionId: signe, confidence: 0.4 }),
      JSON.stringify({ misconceptionId: "inventee", confidence: 0.99 }),
    ]);
    const input = {
      statement: "Résous 3x + 2 = 11.",
      response: "x = 13/3",
      expected: "x = 3",
      misconceptions: ctx().misconceptions,
      context,
    };
    expect(await tutor.analyzeWrongAnswer(input)).toEqual({
      ok: true,
      value: { misconceptionId: signe, confidence: 0.9 },
    });
    expect(await tutor.analyzeWrongAnswer(input)).toEqual({
      ok: true,
      value: null,
    });
    expect(await tutor.analyzeWrongAnswer(input)).toEqual({
      ok: true,
      value: null,
    });
  });

  it("évalue un « explique-moi » ; un échange trop court compte peu", async () => {
    const tutor = scripted([
      JSON.stringify({
        understanding: 0.8,
        confidence: 0.9,
        misconceptionIds: [signe, "inconnue"],
        summary: "Explique bien la balance.",
      }),
    ]);
    const result = await tutor.assess(
      ctx({ mode: "teach_back", exercise: null }),
      [{ role: "learner", content: "On fait pareil des deux côtés." }],
      context,
    );
    expect(result).toEqual({
      ok: true,
      value: {
        understanding: 0.8,
        confidence: 0.3,
        misconceptionIds: [signe],
        summary: "Explique bien la balance.",
      },
    });
  });
});

describe("entretien initial", () => {
  it("garde les préférences connues, ignore les clés inventées et ne retient aucun besoin de santé", async () => {
    const tutor = scripted([
      JSON.stringify({
        hypotheses: [
          { key: "interest", label: "Football", confidence: 0.8 },
          { key: "format.visual", label: null, confidence: 0.6 },
          { key: "need.adhd", label: null, confidence: 0.9 },
          { key: "trouble.invente", label: null, confidence: 0.9 },
        ],
      }),
    ]);
    const result = await tutor.extractIntake(
      [{ role: "learner", content: "J'adore le foot et les dessins." }],
      context,
    );
    expect(result).toEqual({
      ok: true,
      value: [
        { key: "interest", label: "Football", confidence: 0.8 },
        { key: "format.visual", label: null, confidence: 0.6 },
      ],
    });
  });

  it("la consigne de l'entretien interdit les questions de santé et de coordonnées", async () => {
    const seen: ProviderRequest[] = [];
    const tutor = scripted(["Qu'aimes-tu faire après l'école ?"], seen);
    await tutor.intakeReply(
      ["Mathématiques"],
      [{ role: "learner", content: "Bonjour" }],
      context,
    );
    const system = seen[0]?.messages[0]?.content ?? "";
    expect(system).toContain("AUCUNE question sur sa santé");
    expect(system).toContain("ni ses coordonnées");
  });

  it("la consigne du prof IA reprend préférences et adaptations, sans nommer le besoin", () => {
    const prompt = systemPrompt(
      ctx({
        learner: {
          status: "in_progress",
          activeMisconceptions: [],
          preferences: ["Centre d'intérêt : Football"],
          adaptations: ["Une consigne à la fois."],
        },
      }),
    );
    expect(prompt).toContain("Football");
    expect(prompt).toContain("Une consigne à la fois.");
    expect(prompt).not.toMatch(/TDAH|dyslexie/i);
  });
});

describe("résumé d'évaluation", () => {
  it("retire un résumé qui contient une mention médicale", async () => {
    const { safeSummary } = await import("./index");
    expect(safeSummary("Explique bien la balance.")).toBe(
      "Explique bien la balance.",
    );
    expect(safeSummary("Semble avoir un TDAH.")).toMatch(/retiré/);
  });
});

describe("réponses protégées dans tous les modes", () => {
  const open = { kind: "solutions" as const, variable: "x", values: ["3"] };

  it("question de cours sur un exercice recopié : pas de flux, et la solution est rattrapée", async () => {
    const tutor = scripted([
      "Facile, x = 3 donc tu as fini.",
      "Que fais-tu d'abord des deux côtés ?",
    ]);
    const parts: string[] = [];
    const reply = await tutor.reply(
      ctx({
        mode: "course_question",
        exercise: null,
        protectedAnswers: [open],
      }),
      [{ role: "learner", content: "Résous 3x + 2 = 11 et donne x." }],
      context,
      (d) => parts.push(d),
    );
    expect(parts).toEqual([]);
    expect(reply).toEqual({
      ok: true,
      value: { text: "Que fais-tu d'abord des deux côtés ?", guarded: true },
    });
  });

  it("le prof IA peut reprendre une valeur que l'élève a écrite lui-même", async () => {
    const tutor = scripted(["Tu dis que x = 3. Comment l'as-tu trouvé ?"]);
    const reply = await tutor.reply(
      ctx({ mode: "oral_check" }),
      [{ role: "learner", content: "J'ai trouvé x = 3." }],
      context,
    );
    expect(reply.ok && reply.value.guarded).toBe(false);
  });
});
