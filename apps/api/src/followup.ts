import type { AiGateway } from "@wema/ai-gateway";
import {
  type CountryCurriculum,
  createAccountStore,
  createClassStore,
  createCurriculumStore,
  createEventStore,
  createExerciseStore,
  createNudgeStore,
  type SqlExecutor,
} from "@wema/db";
import {
  asUserId,
  type CountryId,
  type LearnerId,
  type Notion,
  type NotionId,
  type ProgramId,
} from "@wema/domain";
import { projectHypotheses } from "@wema/learner-model";
import {
  acceptNudgeText,
  NUDGE_AFTER_DAYS,
  nextActions,
  nudgePrompt,
  nudgeReason,
} from "@wema/orchestrator";
import { learnerModel, MAX_ATTEMPTS_PER_VARIANT } from "./routes/exercises";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Référentiel chargé à la demande et gardé le temps d'un passage (ou d'une
 * requête) : chaque pays n'est lu qu'une fois.
 */
export function createCurriculumCache(db: SqlExecutor) {
  const curriculum = createCurriculumStore(db);
  const countries = new Map<CountryId, CountryCurriculum | null>();
  const notions = new Map<string, Notion>();

  const loadCountry = async (country: CountryId) => {
    if (countries.has(country)) return countries.get(country) ?? null;
    const rows = await curriculum.loadCountry(country);
    countries.set(country, rows);
    for (const n of rows?.notions ?? []) notions.set(n.id, n);
    return rows;
  };

  return {
    async notion(id: NotionId): Promise<Notion | undefined> {
      if (!notions.has(id)) {
        const country = await curriculum.countryOfNotion(id);
        if (country) await loadCountry(country);
      }
      return notions.get(id);
    },
    /** Notions d'un programme, dans l'ordre des unités puis des notions (archives exclues). */
    async programNotions(programId: ProgramId): Promise<Notion[]> {
      const country = await curriculum.countryOfProgram(programId);
      const rows = country ? await loadCountry(country) : null;
      const units = (rows?.units ?? [])
        .filter((u) => u.programId === programId && !u.archived)
        .sort((a, b) => a.position - b.position);
      return units.flatMap((u) =>
        (rows?.notions ?? [])
          .filter((n) => n.unitId === u.id && !n.archived)
          .sort((a, b) => a.position - b.position),
      );
    },
    /** Toutes les notions des pays déjà chargés. */
    loaded: () => [...notions.values()],
  };
}

export type CurriculumCache = ReturnType<typeof createCurriculumCache>;

/** Prochaines actions d'un élève, avec le nom des notions concernées. */
export async function learnerNextActions(
  db: SqlExecutor,
  learnerId: LearnerId,
  now: Date,
  cache: CurriculumCache = createCurriculumCache(db),
) {
  const { model, events } = await learnerModel(db, learnerId);
  const open = await createExerciseStore(db).openVariantsForLearner({
    learnerId,
    maxAttempts: MAX_ATTEMPTS_PER_VARIANT,
  });
  const classStore = createClassStore(db);

  // Programme des classes de l'élève : ordre des unités puis des notions.
  const programNotions: NotionId[] = [];
  for (const k of await classStore.classesOf(asUserId(learnerId), "learner")) {
    if (k.programId)
      programNotions.push(
        ...(await cache.programNotions(k.programId)).map((n) => n.id),
      );
  }
  for (const id of new Set([
    ...Object.values(model.notions).map((n) => n.notionId),
    ...open.map((v) => v.notionId),
  ])) {
    await cache.notion(id);
  }
  // Un exercice « commencé » a déjà au moins un essai de l'élève.
  const exercises = createExerciseStore(db);
  const started = new Set<string>();
  for (const v of open)
    if ((await exercises.countAttempts(v.id, learnerId)) > 0) started.add(v.id);

  const known = cache.loaded();
  const pending = (await classStore.assignmentsForLearner(learnerId)).filter(
    (a) => !a.done && a.variantId,
  );
  const byVariant = new Map<string, NotionId>(
    open.map((v) => [v.id, v.notionId]),
  );
  const actions = nextActions({
    model,
    events,
    prerequisites: new Map(known.map((n) => [n.id, n.prerequisites])),
    openVariants: open.map((v) => ({
      id: v.id,
      notionId: v.notionId,
      started: started.has(v.id),
    })),
    activeNotions: new Set(known.filter((n) => !n.archived).map((n) => n.id)),
    activeMisconceptions: new Set(
      known.flatMap((n) =>
        n.misconceptions.filter((m) => !m.archived).map((m) => m.id),
      ),
    ),
    assignments: pending.flatMap((a) => {
      const notionId = a.variantId ? byVariant.get(a.variantId) : undefined;
      return a.variantId && notionId
        ? [{ variantId: a.variantId, notionId, dueAt: a.dueAt }]
        : [];
    }),
    programNotions,
    now,
  });
  const names = new Map(known.map((n) => [n.id, n.name]));
  const named = actions.map((a) => ({
    ...a,
    notionName: "notionId" in a ? (names.get(a.notionId) ?? null) : null,
  }));
  return { actions: named, events };
}

let running = false;

/**
 * Passage de suivi : pour chaque élève inactif depuis assez longtemps et qui a
 * quelque chose d'utile à faire, prépare une relance (au plus une par jour,
 * avec un espacement qui s'allonge). Un seul passage à la fois ; une erreur
 * chez un élève n'arrête pas les autres.
 */
export async function runFollowUp(
  db: SqlExecutor,
  ai: AiGateway,
  now: Date,
): Promise<{
  checked: number;
  created: number;
  failed: number;
  skipped: boolean;
}> {
  if (running) return { checked: 0, created: 0, failed: 0, skipped: true };
  running = true;
  try {
    const day = now.toISOString().slice(0, 10);
    const nudges = createNudgeStore(db);
    const cache = createCurriculumCache(db);
    let created = 0;
    let failed = 0;
    // Seuls les élèves sans activité depuis au moins le délai minimal sont examinés.
    const learners = await createEventStore(db).lastActivityByLearner({
      inactiveSince: new Date(now.getTime() - NUDGE_AFTER_DAYS * DAY_MS),
    });
    for (const { learnerId, lastActivityAt } of learners) {
      try {
        if (await nudges.hasNudgeOn(learnerId, day)) continue;
        const previousNudges = await nudges.createdSince(
          learnerId,
          lastActivityAt,
        );
        const { actions, events } = await learnerNextActions(
          db,
          learnerId,
          now,
          cache,
        );
        const action = nudgeReason({
          actions,
          lastActivityAt,
          previousNudges,
          now,
        });
        if (!action) continue;
        const named = actions.find((a) => a === action);
        const interests = projectHypotheses(events)
          .hypotheses.filter(
            (h) => h.key.startsWith("interest:") && h.status === "supported",
          )
          .map((h) => h.key.slice("interest:".length));
        // Organisation imputée de façon stable : la première par identifiant.
        const organizationId =
          (await createAccountStore(db).listMemberships(asUserId(learnerId)))
            .map((m) => m.organizationId)
            .sort()[0] ?? null;
        const prompt = nudgePrompt({
          action,
          notionName: named?.notionName ?? null,
          interests,
        });
        const result = await ai.generateText({
          task: "nudge.write",
          context: { organizationId, learnerId },
          temperature: 0.7,
          maxTokens: 120,
          messages: [
            { role: "system", content: prompt.system },
            { role: "user", content: prompt.user },
          ],
        });
        const content = acceptNudgeText(
          action,
          result.ok ? result.value.text : null,
          result.ok ? result.value.truncated === true : false,
        );
        const notionId = "notionId" in action ? action.notionId : null;
        if (
          await nudges.create({
            learnerId,
            day,
            reason: action.kind,
            notionId,
            content,
            createdAt: now,
          })
        )
          created++;
      } catch (e) {
        // Le passage continue pour les autres élèves ; aucune donnée personnelle dans le log.
        failed++;
        console.error(
          `Suivi : échec pour un élève (${e instanceof Error ? e.name : "erreur"})`,
        );
      }
    }
    return { checked: learners.length, created, failed, skipped: false };
  } finally {
    running = false;
  }
}
