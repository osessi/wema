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
      const parsed = z
        .array(exerciseSchema)
        .safeParse(parse(await readFile(join(dir, file), "utf8")));
      if (!parsed.success) {
        errors.push({
          kind: "parse",
          file,
          message: z.prettifyError(parsed.error),
        });
        continue;
      }
      const country = asCountryCode(file.replace(/\.ya?ml$/, ""));
      for (const { notion, ...rest } of parsed.data)
        seeds.push({ ...rest, country, notionCode: notion });
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
