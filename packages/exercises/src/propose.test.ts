import {
  type AiProvider,
  createAiGateway,
  DEFAULT_ROUTING,
} from "@wema/ai-gateway";
import {
  asMisconceptionId,
  asNotionId,
  type ExerciseTask,
  err,
  ok,
} from "@wema/domain";
import { describe, expect, it } from "vitest";
import {
  type AiProposal,
  type MathVerifier,
  type NotionDemand,
  pickWeeklyNotions,
  proposeExercises,
  proposeWeeklyBank,
} from "./index";

const MIS = asMisconceptionId("00000000-0000-4000-8000-000000000001");

function demand(
  code: string,
  position: number,
  counts: Partial<NotionDemand["counts"]> = {},
  alreadyProposed = 0,
): NotionDemand {
  return {
    notionId: asNotionId(`00000000-0000-4000-8000-0000000000${code}`),
    name: `Notion ${code}`,
    description: "",
    context: "Pays · Classe · Matière",
    position,
    counts: {
      not_seen: 0,
      needs_work: 0,
      in_progress: 0,
      mastered: 0,
      ...counts,
    },
    misconceptions: [{ id: MIS, description: "Oublie le signe", learners: 1 }],
    alreadyProposed,
    existingObjectives: [],
  };
}

const good: AiProposal = {
  objective: "Résoudre ax + b = c",
  misconceptionId: MIS,
  statement: "Résous l'équation {equation}.",
  task: {
    kind: "solve",
    equation: "a*x + b = c",
    variable: "x",
    expression: null,
    round: null,
  },
  parameters: [
    {
      name: "a",
      ranges: [
        { min: 2, max: 5 },
        { min: 3, max: 9 },
        { min: 6, max: 15 },
      ],
      exclude: [],
    },
    { name: "b", ranges: [{ min: 1, max: 9 }], exclude: [0] },
    { name: "c", ranges: [{ min: 1, max: 40 }], exclude: [] },
  ],
  constraints: ["Eq(Mod(c - b, a), 0)"],
  steps: ["Retire {b} des deux membres.", "Divise par {a}."],
};

/** Faux fournisseur : renvoie le texte donné, compte les appels. */
function provider(texts: string[]): AiProvider & { calls: number } {
  const p = {
    name: "openrouter" as const,
    calls: 0,
    async generate() {
      const text = texts[p.calls % texts.length] ?? "";
      p.calls++;
      return ok({
        text,
        model: "test/modele",
        usage: { inputTokens: 1, outputTokens: 1, costUsd: 0 },
      });
    },
    async stream() {
      return err({
        kind: "unavailable" as const,
        message: "non utilisé",
        retryable: false,
      });
    },
  };
  return p;
}

const gateway = (p: AiProvider) =>
  createAiGateway({
    providers: { openrouter: p },
    routing: async () => DEFAULT_ROUTING,
    log: async () => {},
    retryDelayMs: 0,
  });

/** Faux services/math : accepte tout, sauf une équation contenant « faux ». */
const verifier = (checked: ExerciseTask[] = []): MathVerifier => ({
  async checkExercise({ task }) {
    checked.push(task);
    if (task.kind === "solve" && task.equation.includes("faux"))
      return err({ kind: "check_failed", reason: "no_solution" });
    return ok({
      index: 0,
      answer: { kind: "solutions", variable: "x", values: ["1"] },
      rendered: { equation: { text: "2x + 1 = 3", latex: "" } },
    });
  },
  checkAnswer: async () => ok({ correct: true, reason: null }),
});

const context = { organizationId: null, learnerId: null };

describe("choix des notions de la semaine", () => {
  it("met d'abord les notions à travailler, garde une place pour la suivante du programme, écarte les notions maîtrisées", () => {
    const picked = pickWeeklyNotions(
      [
        demand("01", 0, { mastered: 3 }),
        demand("02", 1, { in_progress: 2, mastered: 1 }),
        demand("03", 2, { needs_work: 2, in_progress: 1 }),
        demand("04", 3, { not_seen: 3 }),
        demand("05", 4, { not_seen: 3 }),
        demand("06", 5, { needs_work: 1 }),
      ],
      { maxNotions: 3 },
    );
    expect(picked.map((d) => d.name)).toEqual([
      "Notion 03",
      "Notion 06",
      "Notion 04",
    ]);
  });

  it("sans élève, suit l'ordre du programme ; une notion déjà pourvue cette semaine est sautée", () => {
    const picked = pickWeeklyNotions(
      [demand("02", 1), demand("01", 0, {}, 3), demand("03", 2)],
      { maxNotions: 4 },
    );
    expect(picked.map((d) => d.name)).toEqual(["Notion 02", "Notion 03"]);
  });
});

describe("propositions de l'IA", () => {
  it("une sortie valide donne des intentions vérifiées à chaque niveau, sans réponse écrite par l'IA", async () => {
    const checked: ExerciseTask[] = [];
    const result = await proposeExercises({
      ai: gateway(provider([JSON.stringify({ proposals: [good] })])),
      verifier: verifier(checked),
      notion: demand("01", 0, { needs_work: 1 }),
      count: 3,
      context,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rejected).toEqual([]);
    const [intent] = result.value.accepted;
    expect(intent?.task).toEqual({
      kind: "solve",
      equation: "a*x + b = c",
      variable: "x",
    });
    expect(intent?.misconceptionId).toBe(MIS);
    expect(intent?.expected).toBeNull();
    expect(intent?.samples).toHaveLength(3);
    // Trois niveaux, trois vérifications par services/math.
    expect(checked).toHaveLength(3);
  });

  it("une proposition mal formée est écartée seule, avec sa raison ; une idée fausse inconnue n'est pas gardée", async () => {
    const bad: AiProposal = {
      ...good,
      objective: "Paramètre interdit",
      parameters: [{ name: "sqrt", ranges: [{ min: 1, max: 2 }], exclude: [] }],
    };
    const noField: AiProposal = {
      ...good,
      objective: "Sans équation",
      task: { ...good.task, equation: null },
    };
    const unknownMis: AiProposal = {
      ...good,
      objective: "Autre",
      misconceptionId: "inventee",
      task: { ...good.task, equation: "a*x = c" },
    };
    const result = await proposeExercises({
      ai: gateway(
        provider([JSON.stringify({ proposals: [bad, noField, unknownMis] })]),
      ),
      verifier: verifier(),
      notion: demand("01", 0),
      count: 3,
      context,
    });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.rejected.map((r) => [r.objective, r.reason])).toEqual([
      ["Paramètre interdit", "invalid_format"],
      ["Sans équation", "invalid_format"],
    ]);
    expect(result.value.accepted).toHaveLength(1);
    expect(result.value.accepted[0]?.misconceptionId).toBeNull();
  });

  it("une sortie qui n'est pas au schéma est une erreur de l'IA, rien n'entre", async () => {
    const result = await proposeExercises({
      ai: gateway(provider(['{"exercices": []}'])),
      verifier: verifier(),
      notion: demand("01", 0),
      count: 2,
      context,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("invalid_output");
  });

  it("une proposition que services/math refuse est rejetée ; les doublons et le surplus aussi", async () => {
    const wrong: AiProposal = {
      ...good,
      objective: "Faux",
      task: { ...good.task, equation: "faux*x = c" },
    };
    const result = await proposeExercises({
      ai: gateway(
        provider([
          JSON.stringify({ proposals: [wrong, good, good, good, good] }),
        ]),
      ),
      verifier: verifier(),
      notion: demand("01", 0),
      count: 3,
      context,
    });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.rejected.map((r) => r.reason)).toEqual([
      "check_failed",
      "duplicate",
    ]);
    expect(result.value.rejected[0]?.detail).toContain("no_solution");
    expect(result.value.accepted).toHaveLength(1);
  });

  it("le passage hebdomadaire interroge l'IA une fois par notion choisie, sans dépasser le plafond", async () => {
    const p = provider([JSON.stringify({ proposals: [good] })]);
    const results = await proposeWeeklyBank({
      ai: gateway(p),
      verifier: verifier(),
      demands: [
        demand("01", 0, { needs_work: 1 }),
        demand("02", 1, { not_seen: 1 }),
        demand("03", 2, { not_seen: 1 }),
      ],
      context,
      maxNotions: 2,
    });
    expect(p.calls).toBe(2);
    expect(results.map((r) => r.accepted.length)).toEqual([1, 1]);
  });
});
