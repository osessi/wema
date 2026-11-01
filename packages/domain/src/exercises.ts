import { z } from "zod";
import type {
  ExerciseIntentId,
  ExerciseVariantId,
  LearnerId,
  MisconceptionId,
  NotionId,
  OrganizationId,
  UserId,
} from "./ids";

// Un exercice sépare le fond de la forme (architecture §2.4) : l'intention
// fixe ce qui est évalué, la variante est le rendu propre à un élève. Le
// calcul est confié à services/math (SymPy), jamais au TypeScript ni à l'IA.

/** Nom de paramètre : lettre seule ou mot en minuscules (ex. a, k, cote). */
const parameterName = z.string().regex(/^[a-z]{1,12}$/);
/** Expression ou égalité au format SymPy, filtrée côté services/math. */
const mathText = z.string().min(1).max(500);

/** Tâche mathématique générique, paramétrée. */
export const exerciseTaskSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("solve"),
    equation: mathText,
    variable: parameterName,
  }),
  z.object({ kind: z.literal("expand"), expression: mathText }),
  z.object({ kind: z.literal("factor"), expression: mathText }),
  z.object({
    kind: z.literal("evaluate"),
    expression: mathText,
    /** Nombre de décimales attendues ; absent : valeur exacte. */
    round: z.number().int().min(0).max(6).optional(),
  }),
]);
export type ExerciseTask = z.infer<typeof exerciseTaskSchema>;

/** Plage d'un paramètre entier ; une plage par niveau (1 à 3), la dernière sert au-delà. */
export const parameterSpecSchema = z.object({
  name: parameterName,
  ranges: z
    .array(
      z
        .object({
          min: z.number().int().min(-10_000),
          max: z.number().int().max(10_000),
        })
        .refine((r) => r.min <= r.max, {
          message: "min doit être inférieur ou égal à max",
        }),
    )
    .min(1)
    .max(3),
  /** Valeurs interdites (ex. 0 pour un coefficient). */
  exclude: z.array(z.number().int()).max(20).default([]),
});
export type ParameterSpec = z.infer<typeof parameterSpecSchema>;

export type ExerciseStatus = "draft" | "validated" | "archived";
export type ExerciseSource = "teacher" | "admin" | "ai";

export interface ExerciseIntent {
  id: ExerciseIntentId;
  /** Organisation propriétaire ; celle de Wema pour la bibliothèque commune. */
  organizationId: OrganizationId;
  notionId: NotionId;
  /** Ce que l'exercice évalue, en une phrase. */
  objective: string;
  misconceptionId: MisconceptionId | null;
  /** Énoncé avec emplacements : {a} (paramètre) ou {equation} (champ de la tâche rendu). */
  statement: string;
  task: ExerciseTask;
  parameters: readonly ParameterSpec[];
  /** Conditions SymPy sur les paramètres (ex. Ne(a, 0)). */
  constraints: readonly string[];
  /** Étapes de résolution, avec les mêmes emplacements que l'énoncé. */
  steps: readonly string[];
  /** Réponse attendue écrite par l'auteur (facultative), contrôlée par le calcul. */
  expected: string | null;
  status: ExerciseStatus;
  source: ExerciseSource;
  createdBy: UserId | null;
}

/** Réponse attendue, calculée par services/math. */
export const canonicalAnswerSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("solutions"),
    variable: z.string(),
    values: z.array(z.string()),
  }),
  z.object({
    kind: z.literal("expression"),
    value: z.string(),
    form: z.enum(["expanded", "factored", "any"]),
  }),
  z.object({
    kind: z.literal("number"),
    value: z.string(),
    decimals: z.number().int().nullable(),
  }),
]);
export type CanonicalAnswer = z.infer<typeof canonicalAnswerSchema>;

/** Rendu d'un champ mathématique : texte lisible et LaTeX. */
export interface RenderedMath {
  text: string;
  latex: string;
}

/** Forme choisie pour un élève : ce qui change d'une variante à l'autre. */
export interface VariantPlan {
  /** 1 (nombres simples) à 3. */
  level: 1 | 2 | 3;
  /** Énoncé découpé en étapes guidées. */
  scaffolded: boolean;
  /** Indices disponibles d'emblée, de 0 à 3. */
  hintLevel: 0 | 1 | 2 | 3;
}

export interface ExerciseVariant extends VariantPlan {
  id: ExerciseVariantId;
  intentId: ExerciseIntentId;
  learnerId: LearnerId | null;
  seed: number;
  parameters: Readonly<Record<string, number>>;
  statement: string;
  /** Champs mathématiques rendus (equation, expression…). */
  rendered: Readonly<Record<string, RenderedMath>>;
  steps: readonly string[];
  answer: CanonicalAnswer;
  verifiedAt: Date;
}
