import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  Country,
  Grade,
  Notion,
  Program,
  Result,
  Subject,
  Unit,
} from "@wema/domain";
import {
  asCountryCode,
  asCountryId,
  asGradeId,
  asMisconceptionId,
  asNotionId,
  asProgramId,
  asSubjectId,
  asUnitId,
  err,
  ok,
  SUBJECT_ICONS,
} from "@wema/domain";
import { parse } from "yaml";
import { z } from "zod";
import {
  assembleCurriculum,
  type CurriculumError,
  type CurriculumRows,
} from "./assemble";

const subjectsSchema = z.array(
  z.object({
    code: z.string().min(1),
    name: z.string().min(1),
    icon: z.enum(SUBJECT_ICONS).nullable().default(null),
  }),
);

export const countrySchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  unitLabel: z.object({
    singular: z.string().min(1),
    plural: z.string().min(1),
  }),
  grades: z.array(z.string().min(1)).min(1),
});

export const programSchema = z.object({
  grade: z.string().min(1),
  subject: z.string().min(1),
  units: z.array(
    z.object({
      name: z.string().min(1),
      description: z.string().default(""),
      notions: z.array(
        z.object({
          code: z.string().min(1),
          name: z.string().min(1),
          description: z.string().min(1),
          prerequisites: z.array(z.string().min(1)).default([]),
          misconceptions: z
            .array(
              z.object({
                key: z.string().min(1),
                description: z.string().min(1),
              }),
            )
            .default([]),
        }),
      ),
    }),
  ),
});

/**
 * Identifiant déterministe d'une ligne du jeu d'exemple : réimporter le même
 * jeu redonne les mêmes identifiants (import idempotent).
 */
export function seedId(...parts: string[]): string {
  const h = createHash("sha256")
    .update(`wema-seed:${parts.join(":")}`)
    .digest("hex");
  // Mis en forme d'UUID, version 8 (« personnalisée »), variante RFC 4122.
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-8${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

type Read<T> = { ok: true; data: T } | { ok: false; error: CurriculumError };

async function readYaml<T>(
  root: string,
  file: string,
  schema: z.ZodType<T>,
): Promise<Read<T>> {
  try {
    const parsed = schema.safeParse(
      parse(await readFile(join(root, file), "utf8")),
    );
    if (parsed.success) return { ok: true, data: parsed.data };
    return {
      ok: false,
      error: { kind: "parse", file, message: z.prettifyError(parsed.error) },
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: { kind: "parse", file, message } };
  }
}

const isYaml = (f: string) => !f.startsWith(".") && /\.ya?ml$/.test(f);

/**
 * Charge le jeu d'exemple de content/curriculum : subjects.yaml, puis un
 * dossier par pays (country.yaml et un fichier par programme). Renvoie le
 * référentiel validé de chaque pays.
 */
export async function loadCurriculumSeed(
  rootDir: string,
): Promise<Result<CurriculumRows[], CurriculumError[]>> {
  const errors: CurriculumError[] = [];
  const subjectsRead = await readYaml(rootDir, "subjects.yaml", subjectsSchema);
  if (!subjectsRead.ok) return err([subjectsRead.error]);
  const subjects: Subject[] = subjectsRead.data.map((s) => ({
    id: asSubjectId(seedId("subject", s.code)),
    code: s.code,
    name: s.name,
    icon: s.icon,
    archived: false,
  }));
  const subjectByCode = new Map(subjects.map((s) => [s.code, s]));

  const entries = await readdir(rootDir, { withFileTypes: true });
  const dirs = entries
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => e.name)
    .sort();

  const result: CurriculumRows[] = [];
  for (const dir of dirs) {
    const countryRead = await readYaml(
      rootDir,
      `${dir}/country.yaml`,
      countrySchema,
    );
    if (!countryRead.ok) {
      errors.push(countryRead.error);
      continue;
    }
    const c = countryRead.data;
    const code = asCountryCode(c.code);
    const country: Country = {
      id: asCountryId(seedId("country", code)),
      code,
      name: c.name,
      unitLabel: c.unitLabel,
      archived: false,
    };
    const grades: Grade[] = c.grades.map((name, position) => ({
      id: asGradeId(seedId("grade", code, name)),
      countryId: country.id,
      name,
      position,
      archived: false,
    }));
    const gradeByName = new Map(grades.map((g) => [g.name, g]));

    const programs: Program[] = [];
    const units: Unit[] = [];
    const notions: Notion[] = [];
    const files = (await readdir(join(rootDir, dir)))
      .filter((f) => isYaml(f) && f !== "country.yaml")
      .sort();
    for (const file of files) {
      const read = await readYaml(rootDir, `${dir}/${file}`, programSchema);
      if (!read.ok) {
        errors.push(read.error);
        continue;
      }
      const p = read.data;
      const grade = gradeByName.get(p.grade);
      const subject = subjectByCode.get(p.subject);
      if (!grade || !subject) {
        errors.push({
          kind: "parse",
          file: `${dir}/${file}`,
          message: !grade
            ? `classe inconnue : ${p.grade}`
            : `matière inconnue : ${p.subject}`,
        });
        continue;
      }
      const program: Program = {
        id: asProgramId(seedId("program", code, p.grade, p.subject)),
        countryId: country.id,
        gradeId: grade.id,
        subjectId: subject.id,
        archived: false,
      };
      programs.push(program);
      p.units.forEach((u, unitPosition) => {
        const unit: Unit = {
          id: asUnitId(seedId("unit", program.id, u.name)),
          programId: program.id,
          name: u.name,
          description: u.description,
          position: unitPosition,
          archived: false,
        };
        units.push(unit);
        u.notions.forEach((n, position) => {
          const id = asNotionId(seedId("notion", code, n.code));
          notions.push({
            id,
            unitId: unit.id,
            code: n.code,
            name: n.name,
            description: n.description,
            position,
            prerequisites: n.prerequisites.map((pc) =>
              asNotionId(seedId("notion", code, pc)),
            ),
            misconceptions: n.misconceptions.map((m) => ({
              id: asMisconceptionId(
                seedId("misconception", code, n.code, m.key),
              ),
              notionId: id,
              description: m.description,
              archived: false,
            })),
            verified: false,
            archived: false,
          });
        });
      });
    }

    const assembled = assembleCurriculum({
      country,
      subjects,
      grades,
      programs,
      units,
      notions,
    });
    if (!assembled.ok) errors.push(...assembled.error);
    else result.push({ country, subjects, grades, programs, units, notions });
  }

  return errors.length > 0 ? err(errors) : ok(result);
}
