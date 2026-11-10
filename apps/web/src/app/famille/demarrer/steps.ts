/** Étapes du parcours guidé, dans l'ordre (adresse : ?etape=…). */
export const ONBOARDING_STEPS = [
  "bienvenue",
  "famille",
  "enfant",
  "acces",
  "test",
  "abonnement",
  "diagnostic",
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export function isStep(value: string): value is OnboardingStep {
  return ONBOARDING_STEPS.some((s) => s === value);
}

/** Clé des messages de chaque étape. */
export const STEP_KEY = {
  bienvenue: "welcome",
  famille: "family",
  enfant: "child",
  acces: "access",
  test: "placement",
  abonnement: "subscription",
  diagnostic: "diagnostic",
} as const satisfies Record<OnboardingStep, string>;
