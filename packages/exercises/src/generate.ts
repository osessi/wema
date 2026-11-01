import type {
  CanonicalAnswer,
  ExerciseIntent,
  RenderedMath,
  Result,
  VariantPlan,
} from "@wema/domain";
import { err, ok } from "@wema/domain";
import { chooseParameters } from "./parameters";
import { renderTemplate } from "./render";
import type { CheckFailure, MathVerifier } from "./verifier";

/** Variante vérifiée, prête à être enregistrée puis servie. */
export interface GeneratedVariant extends VariantPlan {
  seed: number;
  parameters: Record<string, number>;
  statement: string;
  rendered: Record<string, RenderedMath>;
  steps: string[];
  answer: CanonicalAnswer;
}

export type GenerateError =
  | { kind: "no_valid_parameters"; attempts: number }
  | { kind: "check_failed"; reason: CheckFailure }
  | { kind: "unknown_placeholder"; name: string }
  | { kind: "unavailable"; message: string };

/** Graines essayées avant d'abandonner (contraintes trop strictes pour les plages). */
export const MAX_ATTEMPTS = 25;

/**
 * Décline une intention selon la forme choisie : tire des paramètres, les
 * fait vérifier par services/math, et ne renvoie qu'une variante vérifiée.
 * Une contrainte non satisfaite fait essayer la graine suivante ; toute autre
 * erreur (exercice faux, entrée illisible) arrête tout.
 */
export async function generateVariant(input: {
  intent: Pick<
    ExerciseIntent,
    "task" | "parameters" | "constraints" | "statement" | "steps" | "expected"
  >;
  plan: VariantPlan;
  seed: number;
  verifier: MathVerifier;
}): Promise<Result<GeneratedVariant, GenerateError>> {
  const { intent, plan, verifier } = input;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const seed = (input.seed + attempt) >>> 0;
    const parameters = chooseParameters(intent.parameters, plan.level, seed);
    if (!parameters)
      return err({ kind: "no_valid_parameters", attempts: attempt + 1 });
    const check = await verifier.checkExercise({
      task: intent.task,
      parameters,
      constraints: intent.constraints,
      expected: intent.expected,
    });
    if (!check.ok) {
      if (
        check.error.kind === "check_failed" &&
        check.error.reason === "constraint_failed"
      )
        continue;
      return err(check.error);
    }
    const statement = renderTemplate(
      intent.statement,
      parameters,
      check.value.rendered,
    );
    if (!statement.ok) return err(statement.error);
    const steps: string[] = [];
    for (const step of plan.scaffolded ? intent.steps : []) {
      const rendered = renderTemplate(step, parameters, check.value.rendered);
      if (!rendered.ok) return err(rendered.error);
      steps.push(rendered.value);
    }
    return ok({
      ...plan,
      seed,
      parameters,
      statement: statement.value,
      rendered: check.value.rendered,
      steps,
      answer: check.value.answer,
    });
  }
  return err({ kind: "no_valid_parameters", attempts: MAX_ATTEMPTS });
}

/**
 * Valide une intention avant de la proposer aux élèves : elle doit produire
 * une variante vérifiée à chaque niveau, avec ses étapes.
 */
export async function validateIntent(
  intent: Pick<
    ExerciseIntent,
    "task" | "parameters" | "constraints" | "statement" | "steps" | "expected"
  >,
  verifier: MathVerifier,
  seed = 1,
): Promise<Result<GeneratedVariant[], GenerateError & { level: number }>> {
  const samples: GeneratedVariant[] = [];
  for (const level of [1, 2, 3] as const) {
    const variant = await generateVariant({
      intent,
      plan: { level, scaffolded: true, hintLevel: 0 },
      seed: seed + level * 1000,
      verifier,
    });
    if (!variant.ok) return err({ ...variant.error, level });
    samples.push(variant.value);
  }
  return ok(samples);
}
