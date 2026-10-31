import {
  asCountryCode,
  asMisconceptionId,
  asNotionId,
  asSubjectId,
} from "@wema/domain";
import { z } from "zod";

export const countrySchema = z.object({
  code: z.string().min(1).transform(asCountryCode),
  name: z.string().min(1),
});

export const subjectSchema = z.object({
  id: z.string().min(1).transform(asSubjectId),
  name: z.string().min(1),
});

const mappingSchema = z.object({
  grade: z.string().min(1),
  chapter: z.number().int().positive().nullable(),
  verified: z.boolean(),
});

/** Format d'un fichier de notion dans content/curriculum/<matière>/. */
export const notionFileSchema = z.object({
  id: z.string().min(1).transform(asNotionId),
  subject: z.string().min(1).transform(asSubjectId),
  name: z.string().min(1),
  description: z.string().min(1),
  prerequisites: z.array(z.string().min(1).transform(asNotionId)).default([]),
  misconceptions: z
    .array(
      z.object({
        id: z.string().min(1).transform(asMisconceptionId),
        description: z.string().min(1),
      }),
    )
    .default([]),
  mappings: z.record(z.string(), mappingSchema),
});
