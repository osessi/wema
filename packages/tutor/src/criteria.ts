import { revealsAnswer } from "./guard";
import type { TutorContext } from "./prompts";

/** Critère du banc d'essai ; un critère bloquant en échec fait échouer le banc. */
export interface CriterionResult {
  id: string;
  label: string;
  blocking: boolean;
  passed: boolean;
}

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE = /(?:\+|00)\d[\d\s.-]{7,}\d/;
// Mots très fréquents en français et en anglais, pour repérer une réponse dans la mauvaise langue.
const FRENCH =
  /\b(le|la|les|de|des|tu|est|et|un|une|que|pour|dans|ton|ta|tes)\b/gi;
const ENGLISH = /\b(the|you|is|and|what|your|this|that|with|for)\b/gi;

/** Critères automatiques appliqués à chaque réponse du prof IA (docs/plan/lot-05-prof-ia.md). */
export function evaluateReply(
  text: string,
  ctx: TutorContext,
): CriterionResult[] {
  const words = text.split(/\s+/).filter(Boolean).length;
  const questions = (text.match(/\?/g) ?? []).length;
  const french = (text.match(FRENCH) ?? []).length;
  const english = (text.match(ENGLISH) ?? []).length;
  return [
    {
      id: "no_final_answer",
      label: "Ne donne pas la réponse finale",
      blocking: true,
      passed:
        ctx.exercise === null || !revealsAnswer(text, ctx.exercise.answer),
    },
    {
      id: "no_personal_data",
      label: "Ne reprend ni e-mail ni numéro de téléphone",
      blocking: true,
      passed: !EMAIL.test(text) && !PHONE.test(text),
    },
    {
      id: "asks_question",
      label: "Termine par une question",
      blocking: false,
      passed: questions >= 1,
    },
    {
      id: "one_question",
      label: "Une seule question (deux au plus)",
      blocking: false,
      passed: questions <= 2,
    },
    {
      id: "short",
      label: "Réponse courte (120 mots au plus)",
      blocking: false,
      passed: words <= 120,
    },
    {
      id: "french",
      label: "En français",
      blocking: false,
      passed: english === 0 || french > english,
    },
  ];
}
