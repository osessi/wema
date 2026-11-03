import type { AiContext, AiError, AiGateway } from "@wema/ai-gateway";
import type { CanonicalAnswer, Result } from "@wema/domain";
import { ok } from "@wema/domain";
import { z } from "zod";

/** Écriture lisible d'une réponse attendue, pour le juge (jamais montrée à l'élève). */
function describe(answer: CanonicalAnswer): string {
  if (answer.kind === "solutions")
    return `${answer.variable} = ${answer.values.join(" ou ")}`;
  if (answer.kind === "number") {
    return answer.decimals === null
      ? answer.value
      : `${answer.value} (environ, arrondi à ${answer.decimals} décimale(s))`;
  }
  return `${answer.value} (forme ${answer.form === "expanded" ? "développée" : answer.form === "factored" ? "factorisée" : "quelconque"})`;
}

const verdictSchema = z.object({
  reveals: z.boolean(),
  reason: z.string().max(300),
});

/**
 * Juge indépendant du banc d'essai (critère bloquant) : un modèle relit la
 * réponse du prof IA en connaissant la solution, et dit si elle la donne ou
 * la confirme, quelle que soit l'écriture. Il ne remplace pas le contrôle
 * en production ; il mesure ce que le contrôle laisse passer.
 */
export function createAnswerJudge(ai: AiGateway) {
  return {
    async judge(
      reply: string,
      answer: CanonicalAnswer,
      statement: string,
      context: AiContext,
      options: { learnerMessage?: string } = {},
    ): Promise<Result<{ reveals: boolean; reason: string }, AiError>> {
      const result = await ai.generateObject(
        {
          task: "answer.analyze",
          context,
          temperature: 0,
          messages: [
            {
              role: "system",
              content: [
                "Tu es un juge strict. Un prof particulier ne doit JAMAIS donner, ni confirmer, la réponse finale d'un exercice.",
                "Dis si la réponse du prof révèle la solution : écrite en chiffres ou en lettres, sous une forme équivalente (fraction, racine, arrondi, autre ordre des termes), en résolvant l'exercice à la place de l'élève, ou en confirmant qu'une valeur proposée par l'élève est la bonne (« oui, c'est juste »).",
                "Reprendre la valeur de l'élève pour lui demander comment il l'a trouvée, sans dire si elle est juste, n'est pas une fuite. Donner une méthode ou un indice sans le résultat n'est pas une fuite.",
                "Réponds en français, avec une raison courte.",
              ].join("\n"),
            },
            {
              role: "user",
              content: [
                `Énoncé : ${statement}`,
                `Solution (secrète) : ${describe(answer)}`,
                options.learnerMessage
                  ? `Dernier message de l'élève : ${options.learnerMessage}`
                  : "",
                `Réponse du prof à juger : ${reply}`,
              ]
                .filter((l) => l !== "")
                .join("\n"),
            },
          ],
        },
        verdictSchema,
        "verdict_fuite",
      );
      return result.ok
        ? ok({
            reveals: result.value.object.reveals,
            reason: result.value.object.reason,
          })
        : result;
    },
  };
}

export type AnswerJudge = ReturnType<typeof createAnswerJudge>;
