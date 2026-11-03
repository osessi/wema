import {
  type AiProvider,
  createAiGateway,
  DEFAULT_ROUTING,
  type ProviderRequest,
} from "@wema/ai-gateway";
import { asMisconceptionId, asNotionId, ok } from "@wema/domain";
import { describe, expect, it } from "vitest";
import {
  COPY_SAFE_FALLBACK,
  type CopyReviewInput,
  copyReviewedEvent,
  createCopyReviewer,
} from "./index";

const usage = { inputTokens: 1, outputTokens: 1, costUsd: 0 };
const signe = asMisconceptionId("00000000-0000-4000-8000-0000000000a1");

/** Faux fournisseur : renvoie les réponses prévues, dans l'ordre, et garde les requêtes. */
function scripted(answers: unknown[], seen: ProviderRequest[] = []) {
  const provider: AiProvider = {
    name: "openrouter",
    generate: async (r) => {
      seen.push(r);
      return ok({
        text: JSON.stringify(answers.shift() ?? {}),
        model: "m",
        usage,
      });
    },
    stream: async () => ok({ text: "", model: "m", usage }),
  };
  return createCopyReviewer(
    createAiGateway({
      providers: { openrouter: provider },
      routing: async () => DEFAULT_ROUTING,
      log: async () => {},
    }),
  );
}

const input: CopyReviewInput = {
  subjectName: "Mathématiques",
  notion: { name: "Équations du premier degré", description: "ax + b = c" },
  statement: "Résous 3x + 2 = 14.",
  answer: { kind: "solutions", variable: "x", values: ["4"] },
  expected: "x = 4",
  misconceptions: [
    { id: signe, description: "Change de côté sans changer de signe." },
  ],
  image: { mediaType: "image/jpeg", data: "/9j/4AAQ" },
  context: { organizationId: null, learnerId: null },
};

const wrongCopy = {
  readable: true,
  steps: [
    { text: "3x + 2 = 14", correct: true },
    { text: "3x = 14 + 2", correct: false },
    { text: "3x = 16", correct: true },
    { text: "x = 16/3", correct: true },
  ],
  stuckStep: 1,
  issue: "Le 2 passe de l'autre côté sans changer de signe.",
  misconceptionId: signe,
  misconceptionConfidence: 0.9,
  feedback:
    "Bravo d'avoir posé l'équation. Regarde ta deuxième ligne : que fais-tu aux deux membres pour faire disparaître le + 2 ?",
};

describe("relecture d'une copie photographiée", () => {
  it("envoie l'image avec la tâche copy.review et repère la première étape qui coince", async () => {
    const seen: ProviderRequest[] = [];
    const result = await scripted([wrongCopy], seen).review(input);
    expect(seen[0]?.messages[1]?.images).toEqual([input.image]);
    expect(result.ok).toBe(true);
    if (!result.ok || !result.value.readable) throw new Error("illisible");
    expect(result.value.stuckStep).toBe(1);
    expect(result.value.steps.map((s) => s.status)).toEqual([
      "correct",
      "incorrect",
      "correct",
      // La dernière étape donne un résultat : jamais déclarée juste par l'IA.
      "unverified",
    ]);
    expect(result.value.misconception).toEqual({ id: signe, confidence: 0.9 });
    expect(result.value.guarded).toBe(false);
  });

  it("un retour qui donne la réponse est réécrit, puis remplacé par une relance sûre", async () => {
    const leaky = {
      ...wrongCopy,
      feedback: "Presque ! La bonne réponse est x = 4.",
    };
    const rewritten = scripted([
      leaky,
      {
        issue: null,
        feedback: "Que fais-tu aux deux membres pour enlever + 2 ?",
      },
    ]);
    const first = await rewritten.review(input);
    expect(first.ok && first.value.readable && first.value.feedback).toBe(
      "Que fais-tu aux deux membres pour enlever + 2 ?",
    );
    expect(first.ok && first.value.readable && first.value.guarded).toBe(true);

    const stubborn = scripted([
      leaky,
      { issue: "Il fallait trouver 4.", feedback: "Tu devais obtenir x = 4." },
    ]);
    const second = await stubborn.review(input);
    if (!second.ok || !second.value.readable) throw new Error("illisible");
    expect(second.value.feedback).toBe(COPY_SAFE_FALLBACK);
    expect(second.value.issue).toBeNull();
  });

  it("une étape juste qui écrit la solution n'est jamais déclarée juste", async () => {
    const result = await scripted([
      {
        ...wrongCopy,
        steps: [
          { text: "3x = 12", correct: true },
          { text: "x = 4", correct: true },
          { text: "Vérif : 3 × 4 + 2 = 14", correct: true },
        ],
        stuckStep: null,
        issue: null,
        misconceptionId: null,
        misconceptionConfidence: 0,
        feedback:
          "Ton raisonnement est clair. Saisis ta réponse dans l'application pour la vérifier : comment l'écrirais-tu ?",
      },
    ]).review(input);
    if (!result.ok || !result.value.readable) throw new Error("illisible");
    expect(result.value.steps.map((s) => s.status)).toEqual([
      "correct",
      "unverified",
      "unverified",
    ]);
  });

  it("idée fausse inconnue ou peu sûre : écartée ; photo illisible : aucun événement", async () => {
    const unsure = await scripted([
      { ...wrongCopy, misconceptionConfidence: 0.4 },
    ]).review(input);
    expect(
      unsure.ok && unsure.value.readable && unsure.value.misconception,
    ).toBe(null);
    const invented = await scripted([
      { ...wrongCopy, misconceptionId: "inventee" },
    ]).review(input);
    expect(
      invented.ok && invented.value.readable && invented.value.misconception,
    ).toBe(null);

    const blurry = await scripted([
      { ...wrongCopy, readable: false, steps: [] },
    ]).review(input);
    expect(blurry).toEqual({ ok: true, value: { readable: false } });
    if (!blurry.ok) throw new Error("erreur");
    expect(
      copyReviewedEvent(blurry.value, {
        notionId: asNotionId("n"),
        exerciseRef: null,
      }),
    ).toBeNull();
  });

  it("l'événement du journal résume l'observation, sans la photo", async () => {
    const result = await scripted([wrongCopy]).review(input);
    if (!result.ok) throw new Error("erreur");
    expect(
      copyReviewedEvent(result.value, {
        notionId: asNotionId("n"),
        exerciseRef: "v1",
      }),
    ).toEqual({
      type: "copy.reviewed",
      notionId: "n",
      exerciseRef: "v1",
      stepsRead: 4,
      stepsCorrect: 2,
      stuckStep: 1,
      misconceptionId: signe,
      misconceptionConfidence: 0.9,
      summary: "Le 2 passe de l'autre côté sans changer de signe.",
    });
  });

  it("une réponse hors schéma est une erreur, jamais une relecture devinée", async () => {
    const result = await scripted([{ readable: "oui" }]).review(input);
    expect(result.ok ? null : result.error.kind).toBe("invalid_output");
  });
});
