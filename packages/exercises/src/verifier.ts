import type {
  CanonicalAnswer,
  ExerciseTask,
  RenderedMath,
  Result,
} from "@wema/domain";
import { canonicalAnswerSchema, err, ok } from "@wema/domain";
import { z } from "zod";

export type CheckFailure =
  | "constraint_failed"
  | "no_solution"
  | "mismatch"
  | "invalid_input"
  | "unsupported";

export interface ExerciseCheck {
  answer: CanonicalAnswer;
  rendered: Record<string, RenderedMath>;
}

export type VerifierError =
  | { kind: "check_failed"; reason: CheckFailure }
  | { kind: "unavailable"; message: string };

/**
 * Vérification mathématique, assurée par services/math (SymPy). Aucune
 * variante n'est servie sans être passée par là (AGENTS.md, règle 2).
 */
export interface MathVerifier {
  checkExercise(input: {
    task: ExerciseTask;
    parameters: Readonly<Record<string, number>>;
    constraints: readonly string[];
    expected: string | null;
  }): Promise<Result<ExerciseCheck, VerifierError>>;
  checkAnswer(
    expected: CanonicalAnswer,
    answer: string,
  ): Promise<
    Result<{ correct: boolean; reason: string | null }, VerifierError>
  >;
}

const renderedSchema = z.record(
  z.string(),
  z.object({ text: z.string(), latex: z.string() }),
);
const checkResponse = z.union([
  z.object({
    ok: z.literal(true),
    answer: canonicalAnswerSchema,
    rendered: renderedSchema,
  }),
  z.object({
    ok: z.literal(false),
    reason: z.enum([
      "constraint_failed",
      "no_solution",
      "mismatch",
      "invalid_input",
      "unsupported",
    ]),
  }),
]);
const answerResponse = z.object({
  correct: z.boolean(),
  reason: z.string().nullable().optional(),
});

/** Client HTTP de services/math. */
export function createHttpMathVerifier(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): MathVerifier {
  const post = async (
    path: string,
    body: unknown,
  ): Promise<Result<unknown, VerifierError>> => {
    try {
      const res = await fetchImpl(`${baseUrl}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok)
        return err({
          kind: "unavailable",
          message: `services/math : réponse ${res.status}`,
        });
      return ok(await res.json());
    } catch (e) {
      return err({
        kind: "unavailable",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  };
  return {
    async checkExercise(input) {
      const res = await post("/exercises/check", input);
      if (!res.ok) return res;
      const parsed = checkResponse.safeParse(res.value);
      if (!parsed.success)
        return err({
          kind: "unavailable",
          message: "réponse illisible de services/math",
        });
      const data = parsed.data;
      return data.ok
        ? ok({ answer: data.answer, rendered: data.rendered })
        : err({ kind: "check_failed", reason: data.reason });
    },
    async checkAnswer(expected, answer) {
      const res = await post("/answers/check", { expected, answer });
      if (!res.ok) return res;
      const parsed = answerResponse.safeParse(res.value);
      if (!parsed.success)
        return err({
          kind: "unavailable",
          message: "réponse illisible de services/math",
        });
      return ok({
        correct: parsed.data.correct,
        reason: parsed.data.reason ?? null,
      });
    },
  };
}
