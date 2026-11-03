import { seedId } from "@wema/curriculum";
import {
  bootstrapPlatform,
  createExerciseStore,
  type SqlExecutor,
} from "@wema/db";
import { asNotionId } from "@wema/domain";
import {
  type ExerciseSeed,
  type MathVerifier,
  validateIntent,
} from "@wema/exercises";

export interface ExerciseImportReport {
  created: number;
  skipped: number;
  validated: number;
  /** Exercices refusés par services/math, ou non vérifiés s'il ne répond pas. */
  problems: { notionCode: string; country: string; error: string }[];
}

/**
 * Importe les exercices d'exemple dans la bibliothèque Wema (après le jeu
 * d'exemple du référentiel), puis les fait valider par services/math. Un
 * exercice déjà présent (même notion, même objectif) n'est pas recréé.
 */
export async function importExampleExercises(
  db: SqlExecutor,
  seeds: readonly ExerciseSeed[],
  math: MathVerifier,
): Promise<ExerciseImportReport> {
  const { platform } = await bootstrapPlatform(db, { superAdmin: null });
  const store = createExerciseStore(db);
  const report: ExerciseImportReport = {
    created: 0,
    skipped: 0,
    validated: 0,
    problems: [],
  };
  for (const seed of seeds) {
    // Même identifiant que celui donné par l'import du jeu d'exemple du référentiel.
    const notionId = asNotionId(
      seedId("notion", seed.country, seed.notionCode),
    );
    const existing = await store.listIntents({
      organizationIds: [platform.id],
      notionId,
    });
    let intent = existing.find((i) => i.objective === seed.objective);
    if (intent) {
      report.skipped++;
    } else {
      const created = await store.createIntent({
        notionId,
        objective: seed.objective,
        misconceptionId: null,
        statement: seed.statement,
        task: seed.task,
        parameters: seed.parameters,
        constraints: seed.constraints,
        steps: seed.steps,
        expected: seed.expected,
        organizationId: platform.id,
        source: "admin",
        createdBy: null,
      });
      if (!created.ok) {
        report.problems.push({
          notionCode: seed.notionCode,
          country: seed.country,
          error: created.error.kind,
        });
        continue;
      }
      intent = created.value;
      report.created++;
    }
    if (intent.status === "validated") continue;
    const samples = await validateIntent(intent, math);
    if (!samples.ok) {
      report.problems.push({
        notionCode: seed.notionCode,
        country: seed.country,
        error: samples.error.kind,
      });
      continue;
    }
    await store.setIntentStatus(intent.id, "validated");
    report.validated++;
  }
  return report;
}
