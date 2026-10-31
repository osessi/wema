import type {
  Country,
  CountryCode,
  CurriculumMapping,
  Notion,
  NotionId,
  Result,
  Subject,
} from "@wema/domain";
import { asCountryCode, err, ok } from "@wema/domain";
import { z } from "zod";
import { countrySchema, notionFileSchema, subjectSchema } from "./schema";

export interface Curriculum {
  countries: readonly Country[];
  subjects: readonly Subject[];
  notions: readonly Notion[];
  getNotion(id: NotionId): Notion | undefined;
}

export type CurriculumError =
  | { kind: "parse"; file: string; message: string }
  | { kind: "duplicate_id"; id: string }
  | { kind: "unknown_subject"; notionId: NotionId; subjectId: string }
  | { kind: "unknown_prerequisite"; notionId: NotionId; prerequisiteId: string }
  | { kind: "prerequisite_cycle"; cycle: readonly NotionId[] }
  | { kind: "unknown_country"; notionId: NotionId; country: string }
  | {
      kind: "duplicate_misconception";
      notionId: NotionId;
      misconceptionId: string;
    };

export interface CurriculumInput {
  countries: unknown;
  subjects: unknown;
  /** Une entrée par notion ; `file` sert à nommer la source dans les erreurs. */
  notions: readonly unknown[];
  files?: readonly string[];
}

/**
 * Valide et assemble le référentiel. Toutes les erreurs sont accumulées ;
 * un référentiel partiel n'est jamais renvoyé.
 */
export function buildCurriculum(
  input: CurriculumInput,
): Result<Curriculum, CurriculumError[]> {
  const errors: CurriculumError[] = [];

  const countries = z.array(countrySchema).safeParse(input.countries);
  if (!countries.success) {
    errors.push({
      kind: "parse",
      file: "countries",
      message: countries.error.message,
    });
  }
  const subjects = z.array(subjectSchema).safeParse(input.subjects);
  if (!subjects.success) {
    errors.push({
      kind: "parse",
      file: "subjects",
      message: subjects.error.message,
    });
  }

  const notions: Notion[] = [];
  input.notions.forEach((raw, index) => {
    const parsed = notionFileSchema.safeParse(raw);
    if (!parsed.success) {
      errors.push({
        kind: "parse",
        file: input.files?.[index] ?? `notion #${index}`,
        message: parsed.error.message,
      });
      return;
    }
    const { subject, mappings, ...rest } = parsed.data;
    // Les codes pays sont validés plus bas contre les pays déclarés.
    const typedMappings: Partial<Record<CountryCode, CurriculumMapping>> = {};
    for (const [code, mapping] of Object.entries(mappings)) {
      typedMappings[asCountryCode(code)] = mapping;
    }
    notions.push({ ...rest, subjectId: subject, mappings: typedMappings });
  });

  const countryCodes = new Set<string>(countries.data?.map((c) => c.code));
  const subjectIds = new Set<string>(subjects.data?.map((s) => s.id));
  const byId = new Map<string, Notion>();

  for (const n of notions) {
    if (byId.has(n.id)) errors.push({ kind: "duplicate_id", id: n.id });
    byId.set(n.id, n);
  }

  for (const n of notions) {
    if (subjects.success && !subjectIds.has(n.subjectId)) {
      errors.push({
        kind: "unknown_subject",
        notionId: n.id,
        subjectId: n.subjectId,
      });
    }
    for (const p of n.prerequisites) {
      if (!byId.has(p)) {
        errors.push({
          kind: "unknown_prerequisite",
          notionId: n.id,
          prerequisiteId: p,
        });
      }
    }
    if (countries.success) {
      for (const country of Object.keys(n.mappings)) {
        if (!countryCodes.has(country)) {
          errors.push({ kind: "unknown_country", notionId: n.id, country });
        }
      }
    }
    const seen = new Set<string>();
    for (const m of n.misconceptions) {
      if (seen.has(m.id)) {
        errors.push({
          kind: "duplicate_misconception",
          notionId: n.id,
          misconceptionId: m.id,
        });
      }
      seen.add(m.id);
    }
  }

  for (const cycle of findCycles(byId)) {
    errors.push({ kind: "prerequisite_cycle", cycle });
  }

  if (errors.length > 0 || !countries.success || !subjects.success) {
    return err(errors);
  }
  return ok({
    countries: countries.data,
    subjects: subjects.data,
    notions,
    getNotion: (id) => byId.get(id),
  });
}

/** Parcours en profondeur à trois couleurs ; un cycle par arc retour trouvé. */
function findCycles(byId: ReadonlyMap<string, Notion>): NotionId[][] {
  const state = new Map<string, "visiting" | "done">();
  const stack: NotionId[] = [];
  const cycles: NotionId[][] = [];

  const visit = (id: NotionId): void => {
    state.set(id, "visiting");
    stack.push(id);
    for (const p of byId.get(id)?.prerequisites ?? []) {
      if (!byId.has(p)) continue;
      const s = state.get(p);
      if (s === "visiting") cycles.push(stack.slice(stack.indexOf(p)));
      else if (s === undefined) visit(p);
    }
    stack.pop();
    state.set(id, "done");
  };

  for (const n of byId.values()) {
    if (!state.has(n.id)) visit(n.id);
  }
  return cycles;
}
