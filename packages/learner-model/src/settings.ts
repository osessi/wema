import type { Result } from "@wema/domain";
import { err, ok } from "@wema/domain";
import { z } from "zod";
import { type BktParams, DEFAULT_BKT, MASTERY_CEILING } from "./bkt";

/** Réglages pédagogiques du calcul de maîtrise, modifiables dans le back-office. */
export interface LearnerModelSettings {
  bkt: BktParams;
  /** Maîtrise à partir de laquelle une notion est « En cours ». */
  inProgressThreshold: number;
  /** Maîtrise à partir de laquelle une notion devient candidate à la validation. */
  masteryThreshold: number;
  /** Délai minimal, en heures, entre le passage du seuil et la bonne réponse qui confirme. */
  reconfirmDelayHours: number;
  /** Bonnes réponses nécessaires pour lever une idée fausse. */
  misconceptionClearingStreak: number;
}

export const DEFAULT_SETTINGS: LearnerModelSettings = {
  bkt: DEFAULT_BKT,
  inProgressThreshold: 0.5,
  masteryThreshold: 0.95,
  reconfirmDelayHours: 72,
  misconceptionClearingStreak: 2,
};

const probability = z.number().gt(0).lt(1);

const settingsSchema = z
  .object({
    bkt: z.object({
      pInit: probability,
      pLearn: probability,
      pSlip: probability,
      pGuess: probability,
    }),
    inProgressThreshold: probability,
    masteryThreshold: probability,
    reconfirmDelayHours: z
      .number()
      .int()
      .min(0)
      .max(24 * 365),
    misconceptionClearingStreak: z.number().int().min(1).max(50),
  })
  .refine((s) => s.masteryThreshold < MASTERY_CEILING, {
    message:
      "Le seuil « Validé » doit rester sous le plafond de la maîtrise estimée (0,9999).",
    path: ["masteryThreshold"],
  })
  .refine((s) => s.inProgressThreshold < s.masteryThreshold, {
    message: "Le seuil « En cours » doit être inférieur au seuil « Validé ».",
    path: ["inProgressThreshold"],
  })
  .refine((s) => s.bkt.pSlip + s.bkt.pGuess < 1, {
    message:
      "La somme des probabilités d'erreur d'inattention et de réponse au hasard doit rester inférieure à 1, sinon une bonne réponse ne prouve rien.",
    path: ["bkt"],
  });

export type SettingsError = {
  kind: "invalid_settings";
  issues: { path: string; message: string }[];
};

/** Valide des réglages venus de la base ou d'un formulaire. */
export function parseLearnerModelSettings(
  input: unknown,
): Result<LearnerModelSettings, SettingsError> {
  const parsed = settingsSchema.safeParse(input);
  if (parsed.success) return ok(parsed.data);
  return err({
    kind: "invalid_settings",
    issues: parsed.error.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
    })),
  });
}
