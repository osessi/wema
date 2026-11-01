import {
  createCurriculumStore,
  createExerciseStore,
  createHealthStore,
  createTutorStore,
  type SqlExecutor,
} from "@wema/db";
import {
  type CanonicalAnswer,
  type ExerciseVariantId,
  type LearnerId,
  NEEDS,
  type NotionId,
  type TutorMode,
} from "@wema/domain";
import { projectHypotheses } from "@wema/learner-model";
import type { TutorContext } from "@wema/tutor";
import { learnerModel, MAX_ATTEMPTS_PER_VARIANT } from "./routes/exercises";

/** Écriture lisible d'une réponse attendue (pour l'analyse d'une réponse fausse, jamais envoyée à l'élève). */
export function describeAnswer(answer: CanonicalAnswer): string {
  if (answer.kind === "solutions")
    return `${answer.variable} = ${answer.values.join(" ou ")}`;
  if (answer.kind === "number")
    return answer.decimals === null
      ? answer.value
      : `${answer.value} (arrondi à ${answer.decimals} décimale(s))`;
  return answer.value;
}

/** Notion et matière d'une notion, avec ses idées fausses non archivées. */
export async function notionInfo(db: SqlExecutor, notionId: NotionId) {
  const curriculum = createCurriculumStore(db);
  const countryId = await curriculum.countryOfNotion(notionId);
  const rows = countryId ? await curriculum.loadCountry(countryId) : null;
  const notion = rows?.notions.find((n) => n.id === notionId);
  const unit = rows?.units.find((u) => u.id === notion?.unitId);
  const program = rows?.programs.find((p) => p.id === unit?.programId);
  const subject = rows?.subjects.find((s) => s.id === program?.subjectId);
  if (!notion || !subject) return null;
  return {
    notion,
    subject,
    misconceptions: notion.misconceptions
      .filter((m) => !m.archived)
      .map((m) => ({ id: m.id, description: m.description })),
  };
}

/**
 * Contexte du prof IA pour une séance : notion, matière et ses consignes,
 * état de l'élève (sans aucune donnée personnelle), exercice éventuel.
 */
export async function buildTutorContext(
  db: SqlExecutor,
  input: {
    /** Clé des données de santé : seules les adaptations des besoins consentis en sortent. */
    healthKey: Buffer;
    learnerId: LearnerId;
    notionId: NotionId;
    variantId: ExerciseVariantId | null;
    mode: TutorMode;
    hintLevel: number;
  },
): Promise<TutorContext | null> {
  const info = await notionInfo(db, input.notionId);
  if (!info) return null;
  const variant = input.variantId
    ? await createExerciseStore(db).getVariant(input.variantId)
    : null;
  if (input.variantId && (!variant || variant.learnerId !== input.learnerId))
    return null;
  const { model, events } = await learnerModel(db, input.learnerId);
  const profile = projectHypotheses(events);
  // Réponses protégées : celle de l'exercice et celles des autres exercices encore ouverts sur la notion.
  // Toutes les variantes ouvertes de l'élève, quelle que soit la notion de la séance.
  const open = await createExerciseStore(db).openVariantsForLearner({
    learnerId: input.learnerId,
    maxAttempts: MAX_ATTEMPTS_PER_VARIANT,
  });
  const needs = await createHealthStore(db, input.healthKey).list(
    input.learnerId,
  );
  const state = model.notions[input.notionId];
  const active = new Set(
    state?.misconceptions
      .filter((m) => m.active)
      .map((m) => m.misconceptionId) ?? [],
  );
  return {
    mode: input.mode,
    subjectName: info.subject.name,
    subjectInstructions: await createTutorStore(db).getTutorInstructions(
      info.subject.id,
    ),
    notion: { name: info.notion.name, description: info.notion.description },
    misconceptions: info.misconceptions,
    learner: {
      status: state?.status ?? "not_seen",
      activeMisconceptions: info.misconceptions
        .filter((m) => active.has(m.id))
        .map((m) => m.description),
      preferences: profile.hypotheses
        .filter((h) => h.status === "supported" && h.confidence >= 0.35)
        .map((h) => h.statement),
      // Seulement l'adaptation qui découle d'un besoin déclaré, jamais le besoin lui-même.
      adaptations: needs
        .filter((n) => n.active && n.consent === "given")
        .map((n) => NEEDS[n.need].adaptation),
    },
    protectedAnswers: [
      ...(variant ? [variant.answer] : []),
      ...open.filter((v) => v.id !== variant?.id).map((v) => v.answer),
    ],
    exercise: variant
      ? {
          statement: variant.statement,
          steps: variant.steps,
          scaffolded: variant.scaffolded,
          answer: variant.answer,
        }
      : null,
    hintLevel: input.hintLevel,
  };
}

/** Matières proposées, pour situer l'entretien initial. */
export async function subjectNamesOf(
  db: SqlExecutor,
  _learnerId: LearnerId,
): Promise<string[]> {
  return (await createCurriculumStore(db).listSubjects())
    .filter((s) => !s.archived)
    .map((s) => s.name);
}
