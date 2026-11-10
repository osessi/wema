import type { OrganizationId, UserId } from "@wema/domain";
import type { SqlExecutor } from "./executor";

/** Étapes du démarrage que le prof règle lui-même (les autres se déduisent). */
export const ONBOARDING_STEPS = ["welcome", "parents", "checklist"] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];
export type OnboardingStatus = "done" | "skipped";

export function createOnboardingStore(db: SqlExecutor) {
  return {
    async steps(
      organizationId: OrganizationId,
      userId: UserId,
    ): Promise<Partial<Record<OnboardingStep, OnboardingStatus>>> {
      const { rows } = await db.query<{ step: string; status: string }>(
        "SELECT step, status FROM onboarding_steps WHERE organization_id = $1 AND user_id = $2",
        [organizationId, userId],
      );
      const out: Partial<Record<OnboardingStep, OnboardingStatus>> = {};
      for (const r of rows) {
        const step = ONBOARDING_STEPS.find((s) => s === r.step);
        if (step && (r.status === "done" || r.status === "skipped"))
          out[step] = r.status;
      }
      return out;
    },

    async setStep(input: {
      organizationId: OrganizationId;
      userId: UserId;
      step: OnboardingStep;
      status: OnboardingStatus;
    }): Promise<void> {
      await db.query(
        `INSERT INTO onboarding_steps (organization_id, user_id, step, status) VALUES ($1, $2, $3, $4)
         ON CONFLICT (organization_id, user_id, step) DO UPDATE SET status = EXCLUDED.status, updated_at = now()`,
        [input.organizationId, input.userId, input.step, input.status],
      );
    },
  };
}
