import type { AiGateway } from "@wema/ai-gateway";
import {
  createAccountStore,
  createCurriculumStore,
  createEventStore,
  createExerciseStore,
  createNudgeStore,
  type SqlExecutor,
} from "@wema/db";
import { asUserId, type LearnerId, type NotionId } from "@wema/domain";
import { projectHypotheses } from "@wema/learner-model";
import { type NextAction, nextActions, nudgeReason } from "@wema/orchestrator";
import { learnerModel, MAX_ATTEMPTS_PER_VARIANT } from "./routes/exercises";
import { notionInfo } from "./tutor-context";

/** Prérequis de chaque notion du pays des notions données (graphe du référentiel). */
async function prerequisitesFor(
  db: SqlExecutor,
  notionIds: readonly NotionId[],
) {
  const curriculum = createCurriculumStore(db);
  const map = new Map<string, readonly NotionId[]>();
  const countries = new Set<string>();
  for (const id of notionIds) {
    const country = await curriculum.countryOfNotion(id);
    if (!country || countries.has(country)) continue;
    countries.add(country);
    const rows = await curriculum.loadCountry(country);
    for (const n of rows?.notions ?? []) map.set(n.id, n.prerequisites);
  }
  return map;
}

/** Prochaines actions d'un élève, avec le nom des notions concernées. */
export async function learnerNextActions(
  db: SqlExecutor,
  learnerId: LearnerId,
  now: Date,
) {
  const { model, events } = await learnerModel(db, learnerId);
  const open = await createExerciseStore(db).openVariantsForLearner({
    learnerId,
    maxAttempts: MAX_ATTEMPTS_PER_VARIANT,
  });
  const notionIds = [
    ...new Set([
      ...Object.values(model.notions).map((n) => n.notionId),
      ...open.map((v) => v.notionId),
    ]),
  ];
  const actions = nextActions({
    model,
    events,
    prerequisites: await prerequisitesFor(db, notionIds),
    openVariants: open.map((v) => ({ id: v.id, notionId: v.notionId })),
    now,
  });
  return { actions, events };
}

const FALLBACK: Record<NextAction["kind"], string> = {
  finish_exercise:
    "Tu as un exercice commencé qui t'attend. On le termine ensemble ?",
  easy_win:
    "Et si on reprenait avec un petit exercice facile pour se remettre en route ?",
  prerequisite_first:
    "J'ai une idée pour t'aider à débloquer la notion : on revoit une base ensemble ?",
  misconception_focus:
    "On fait un petit point sur une erreur qui revient ? Ça va t'aider pour la suite.",
  practice: "Prêt pour quelques minutes de pratique aujourd'hui ?",
  spaced_review:
    "Petit rappel rapide sur une notion que tu maîtrises, pour ne pas l'oublier ?",
  intake:
    "On fait connaissance ? Quelques questions pour que je t'aide au mieux.",
};

/** Rédige une relance courte et bienveillante ; texte de secours si l'IA ne répond pas. */
async function writeNudge(
  ai: AiGateway,
  action: NextAction,
  notionName: string | null,
  interests: readonly string[],
  organizationId: string | null,
  learnerId: LearnerId,
) {
  const result = await ai.generateText({
    task: "nudge.write",
    context: { organizationId, learnerId },
    temperature: 0.7,
    maxTokens: 80,
    messages: [
      {
        role: "system",
        content: [
          "Écris une relance d'une ou deux phrases, en français, pour un élève (tutoiement), chaleureuse et motivante, qui finit par une question.",
          "Aucun prénom, aucune donnée personnelle, aucun exercice ni aucune réponse : seulement l'envie de reprendre.",
          `Raison de la relance : ${action.reason}`,
          notionName ? `Notion concernée : ${notionName}.` : "",
          interests.length > 0
            ? `Tu peux faire un clin d'œil à ses centres d'intérêt : ${interests.join(", ")}.`
            : "",
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
  });
  const text = result.ok ? result.value.text.trim() : "";
  return text.length > 0 && text.length <= 400 ? text : FALLBACK[action.kind];
}

/**
 * Passage de suivi : pour chaque élève inactif depuis assez longtemps et qui a
 * quelque chose d'utile à faire, prépare une relance (au plus une par jour).
 */
export async function runFollowUp(
  db: SqlExecutor,
  ai: AiGateway,
  now: Date,
): Promise<{ checked: number; created: number }> {
  const day = now.toISOString().slice(0, 10);
  const nudges = createNudgeStore(db);
  let created = 0;
  const learners = await createEventStore(db).lastActivityByLearner();
  for (const { learnerId, lastActivityAt } of learners) {
    if (await nudges.hasNudgeOn(learnerId, day)) continue;
    const { actions, events } = await learnerNextActions(db, learnerId, now);
    const action = nudgeReason({ actions, lastActivityAt, now });
    if (!action) continue;
    const notionId = "notionId" in action ? action.notionId : null;
    const notionName = notionId
      ? ((await notionInfo(db, notionId))?.notion.name ?? null)
      : null;
    const interests = projectHypotheses(events)
      .hypotheses.filter(
        (h) => h.key.startsWith("interest:") && h.status === "supported",
      )
      .map((h) => h.key.slice("interest:".length));
    const memberships = await createAccountStore(db).listMemberships(
      asUserId(learnerId),
    );
    const content = await writeNudge(
      ai,
      action,
      notionName,
      interests,
      memberships[0]?.organizationId ?? null,
      learnerId,
    );
    if (
      await nudges.create({
        learnerId,
        day,
        reason: action.kind,
        notionId,
        content,
      })
    )
      created++;
  }
  return { checked: learners.length, created };
}
