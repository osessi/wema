import type { AiContext, AiError, AiGateway } from "@wema/ai-gateway";
import type { CanonicalAnswer, RenderedMath, Result } from "@wema/domain";
import { err, ok } from "@wema/domain";
import { z } from "zod";
import { checkFaithful, type FaithfulnessError } from "./numbers";

// Reformulations d'un énoncé VÉRIFIÉ par l'IA (via @wema/ai-gateway) : bande
// dessinée et lecture facile. L'IA ne touche qu'à la forme : chaque sortie est
// validée par Zod, puis contrôlée par checkFaithful (mêmes formules, mêmes
// nombres, pas de nombre ajouté, pas de réponse). Sinon on garde le texte.

const COLORS = ["butter", "peach", "mint", "rose", "lime", "sand"] as const;
const LOOKS = ["round", "tall", "small"] as const;
const PLACES = [
  "indoor",
  "outdoor",
  "school",
  "shop",
  "field",
  "kitchen",
  "none",
] as const;

const shortText = (max: number) => z.string().trim().min(1).max(max);

/** Bande dessinée de 3 à 5 cases : personnages simples, bulles, décor décrit. */
export const comicsSchema = z
  .object({
    title: shortText(80),
    characters: z
      .array(
        z.object({
          id: z.string().regex(/^[a-z]{1,12}$/),
          name: shortText(24),
          look: z.enum(LOOKS),
          color: z.enum(COLORS),
        }),
      )
      .min(1)
      .max(3),
    panels: z
      .array(
        z.object({
          place: z.enum(PLACES),
          /** Décor décrit en une phrase (lu par les lecteurs d'écran). */
          setting: shortText(140),
          caption: shortText(200).nullable(),
          bubbles: z
            .array(
              z.object({
                speaker: z.string().regex(/^[a-z]{1,12}$/),
                kind: z.enum(["speech", "thought"]),
                text: shortText(200),
              }),
            )
            .max(3),
        }),
      )
      .min(3)
      .max(5),
  })
  .refine(
    (c) =>
      c.panels.every((p) =>
        p.bubbles.every((b) => c.characters.some((ch) => ch.id === b.speaker)),
      ),
    { message: "bulle d'un personnage inconnu" },
  );
export type ComicsContent = z.infer<typeof comicsSchema>;

/** Lecture facile : une idée par phrase, phrases courtes. */
export const easyReadingSchema = z.object({
  sentences: z.array(shortText(140)).min(1).max(8),
});
export type EasyReadingContent = z.infer<typeof easyReadingSchema>;

/** Textes d'une BD, dans l'ordre de lecture (contrôle et accessibilité). */
export function comicsTexts(c: ComicsContent): string[] {
  return c.panels.flatMap((p) => [
    ...(p.caption ? [p.caption] : []),
    ...p.bubbles.map((b) => b.text),
  ]);
}

export type AdaptError =
  | { kind: "ai"; error: AiError }
  | { kind: "unfaithful"; reason: FaithfulnessError };

/** Ce que l'IA reçoit : l'énoncé vérifié, jamais la réponse ni de donnée d'élève. */
interface AdaptInput {
  ai: Pick<AiGateway, "generateObject">;
  statement: string;
  rendered: Readonly<Record<string, RenderedMath>>;
  /** Réponse attendue : sert seulement au contrôle, n'est pas envoyée à l'IA. */
  answer: CanonicalAnswer;
  context: AiContext;
}

const COMMON_RULES = [
  "Règles impératives :",
  "- Tu ne changes AUCUNE donnée : chaque nombre de l'énoncé apparaît, écrit en chiffres, exactement comme dans l'énoncé.",
  "- Tu n'ajoutes aucun nombre (ni âge, ni heure, ni quantité, ni numéro de case).",
  "- Tu recopies chaque formule (équation, expression) caractère pour caractère.",
  "- Tu ne résous rien et tu ne donnes ni la réponse, ni un résultat intermédiaire, ni un indice de calcul.",
  "- Tu tutoies l'élève. Pas de stéréotype, pas de moquerie.",
];

function formulasOf(input: AdaptInput): string[] {
  return Object.values(input.rendered)
    .map((r) => r.text)
    .filter((t) => t.length > 0 && input.statement.includes(t));
}

/**
 * Bande dessinée tirée de l'énoncé. Les centres d'intérêt (libellés sûrs du
 * profil) peuvent servir de décor, sans changer l'exercice.
 */
export async function adaptToComics(
  input: AdaptInput & { interests?: readonly string[] },
): Promise<Result<{ content: ComicsContent; model: string }, AdaptError>> {
  const system = [
    "Tu transformes l'énoncé d'un exercice en courte bande dessinée de 3 à 5 cases, pour un élève.",
    "Chaque case a un décor (place parmi la liste, setting : une phrase qui le décrit), une légende facultative et 0 à 3 bulles.",
    "1 à 3 personnages (id en minuscules sans accent, name : un prénom court, look et color dans les listes).",
    "La dernière case pose clairement la question de l'énoncé, avec sa formule recopiée telle quelle.",
    ...COMMON_RULES,
  ].join("\n");
  const user = [
    `Énoncé : ${input.statement}`,
    `Formules à recopier telles quelles : ${formulasOf(input).join(" ; ") || "aucune"}`,
    input.interests && input.interests.length > 0
      ? `Centres d'intérêt possibles pour le décor : ${input.interests.join(", ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
  const result = await input.ai.generateObject(
    {
      task: "exercise.comics",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      context: input.context,
      temperature: 0.7,
      maxTokens: 1500,
    },
    comicsSchema,
    "bande_dessinee",
  );
  if (!result.ok) return err({ kind: "ai", error: result.error });
  const content = result.value.object;
  const check = checkFaithful({
    statement: input.statement,
    rendered: input.rendered,
    answer: input.answer,
    produced: [content.title, ...comicsTexts(content)],
  });
  if (!check.ok) return err({ kind: "unfaithful", reason: check.error });
  return ok({ content, model: result.value.model });
}

/** Énoncé en lecture facile : phrases courtes, une idée par phrase. */
export async function adaptToEasyReading(
  input: AdaptInput,
): Promise<Result<{ content: EasyReadingContent; model: string }, AdaptError>> {
  const system = [
    "Tu réécris l'énoncé d'un exercice en lecture facile : 1 à 8 phrases très courtes (12 mots au plus), une idée par phrase, mots simples et courants, voix active.",
    "La dernière phrase dit ce que l'élève doit faire.",
    ...COMMON_RULES,
  ].join("\n");
  const result = await input.ai.generateObject(
    {
      task: "exercise.simplify",
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: `Énoncé : ${input.statement}\nFormules à recopier telles quelles : ${formulasOf(input).join(" ; ") || "aucune"}`,
        },
      ],
      context: input.context,
      temperature: 0.2,
      maxTokens: 600,
    },
    easyReadingSchema,
    "lecture_facile",
  );
  if (!result.ok) return err({ kind: "ai", error: result.error });
  const content = result.value.object;
  const check = checkFaithful({
    statement: input.statement,
    rendered: input.rendered,
    answer: input.answer,
    produced: content.sentences,
  });
  if (!check.ok) return err({ kind: "unfaithful", reason: check.error });
  return ok({ content, model: result.value.model });
}

/**
 * Lecture facile sans IA : l'énoncé découpé en phrases (aux points et
 * points-virgules hors nombres). Les données sont celles de l'énoncé, telles quelles.
 */
export function splitSentences(statement: string): EasyReadingContent {
  const sentences = statement
    .split(/(?<=[.;!?])\s+(?=\S)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return { sentences: sentences.length > 0 ? sentences : [statement] };
}
