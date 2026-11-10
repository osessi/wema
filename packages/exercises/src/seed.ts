import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { CountryCode, Result } from "@wema/domain";
import {
  asCountryCode,
  err,
  exerciseTaskSchema,
  ok,
  parameterSpecSchema,
} from "@wema/domain";
import { parse } from "yaml";
import { z } from "zod";

const exerciseSchema = z.object({
  notion: z.string().min(1),
  objective: z.string().min(1),
  statement: z.string().min(1),
  task: exerciseTaskSchema,
  parameters: z.array(parameterSpecSchema).max(10),
  constraints: z.array(z.string()).default([]),
  steps: z.array(z.string()).default([]),
  expected: z.string().nullable().default(null),
});

/** Exercice du jeu d'exemple : sa notion est désignée par son code dans le pays. */
export interface ExerciseSeed
  extends Omit<z.infer<typeof exerciseSchema>, "notion"> {
  country: CountryCode;
  notionCode: string;
}

export type ExerciseSeedError = {
  kind: "parse";
  file: string;
  message: string;
};

/**
 * Lit des exercices au format de content/exercises (liste YAML), pour un pays
 * donné : sert à l'import en masse depuis le back-office.
 */
export function parseExerciseYaml(
  text: string,
  country: CountryCode,
  file = "import",
): Result<ExerciseSeed[], ExerciseSeedError[]> {
  try {
    const parsed = z.array(exerciseSchema).max(500).safeParse(parse(text));
    if (!parsed.success)
      return err([
        { kind: "parse", file, message: z.prettifyError(parsed.error) },
      ]);
    return ok(
      parsed.data.map(({ notion, ...rest }) => ({
        ...rest,
        country,
        notionCode: notion,
      })),
    );
  } catch (e) {
    return err([
      {
        kind: "parse",
        file,
        message: e instanceof Error ? e.message : String(e),
      },
    ]);
  }
}

/** Charge content/exercises : un fichier YAML par pays (fr.yaml, bj.yaml…). */
export async function loadExerciseSeed(
  dir: string,
): Promise<Result<ExerciseSeed[], ExerciseSeedError[]>> {
  const files = (await readdir(dir))
    .filter((f) => !f.startsWith(".") && /\.ya?ml$/.test(f))
    .sort();
  const seeds: ExerciseSeed[] = [];
  const errors: ExerciseSeedError[] = [];
  for (const file of files) {
    try {
      const parsed = parseExerciseYaml(
        await readFile(join(dir, file), "utf8"),
        asCountryCode(file.replace(/\.ya?ml$/, "")),
        file,
      );
      if (!parsed.ok) errors.push(...parsed.error);
      else seeds.push(...parsed.value);
    } catch (e) {
      errors.push({
        kind: "parse",
        file,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return errors.length > 0 ? err(errors) : ok(seeds);
}
