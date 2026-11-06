import type { AiContext, AiError, AiGateway } from "@wema/ai-gateway";
import type {
  ExerciseTask,
  MisconceptionId,
  NotionId,
  ParameterSpec,
  Result,
} from "@wema/domain";
import { err, exerciseTaskSchema, ok, parameterSpecSchema } from "@wema/domain";
import { z } from "zod";
import { type GenerateError, validateIntent } from "./generate";
import type { MathVerifier } from "./verifier";

// Banque hebdomadaire proposée par l'IA : l'IA rédige des intentions
// d'exercices pour les notions de la semaine, puis chacune est vérifiée par
// services/math (AGENTS.md, règle 2). Le calcul n'est jamais confié à l'IA :
// elle écrit une tâche paramétrée, SymPy calcule la réponse.

/** Notions traitées par passage. */
export const MAX_NOTIONS_PER_WEEK = 4;
/** Propositions demandées par notion. */
export const PROPOSALS_PER_NOTION = 3;

/** Ce que les classes d'une organisation font d'une notion cette semaine. */
export interface NotionDemand {
  notionId: NotionId;
  name: string;
  description: string;
  /** Pays, classe et matière du programme (ex. « France · 4e · Mathématiques »). */
  context: string;
  /** Rang dans le programme (unités puis notions) : le plus petit est vu en premier. */
  position: number;
  /** Élèves des classes par statut sur la notion. */
  counts: {
    not_seen: number;
    needs_work: number;
    in_progress: number;
    mastered: number;
  };
  misconceptions: readonly {
    id: MisconceptionId;
    description: string;
    /** Élèves chez qui cette idée fausse est active. */
    learners: number;
  }[];
  /** Propositions de l'IA déjà dans la banque de la semaine (ni écartées). */
  alreadyProposed: number;
  /** Objectifs des exercices déjà dans la banque, pour ne pas les refaire. */
  existingObjectives: readonly string[];
}

/**
 * Notions à alimenter cette semaine :
 * - d'abord les notions « à travailler » (élèves en difficulté, puis en cours) ;
 * - au moins une notion « à venir » (pas encore vue), dans l'ordre du programme ;
 * - jamais une notion que tous les élèves maîtrisent, ni une notion qui a déjà
 *   ses propositions de l'IA pour la semaine.
 */
export function pickWeeklyNotions(
  demands: readonly NotionDemand[],
  options: { maxNotions?: number; perNotion?: number } = {},
): NotionDemand[] {
  const max = options.maxNotions ?? MAX_NOTIONS_PER_WEEK;
  const per = options.perNotion ?? PROPOSALS_PER_NOTION;
  if (max <= 0) return [];
  const open = demands.filter((d) => {
    const learners =
      d.counts.not_seen +
      d.counts.needs_work +
      d.counts.in_progress +
      d.counts.mastered;
    const allMastered = learners > 0 && d.counts.mastered === learners;
    return !allMastered && d.alreadyProposed < per;
  });
  const toWork = open
    .filter((d) => d.counts.needs_work + d.counts.in_progress > 0)
    .sort(
      (a, b) =>
        b.counts.needs_work - a.counts.needs_work ||
        b.counts.in_progress - a.counts.in_progress ||
        a.position - b.position,
    );
  const upcoming = open
    .filter((d) => d.counts.needs_work + d.counts.in_progress === 0)
    .sort((a, b) => a.position - b.position);
  // Une place est gardée pour la prochaine notion du programme, s'il y en a une.
  const reserved = upcoming.length > 0 ? 1 : 0;
  const first = toWork.slice(0, max - reserved);
  return [...first, ...upcoming].slice(0, max);
}

// Sortie demandée au modèle : volontairement souple (le fournisseur la
// contraint par un schéma JSON simple), puis contrôlée champ par champ par
// les schémas du domaine. Une proposition non conforme est écartée seule.
const aiProposal = z.object({
  objective: z.string(),
  misconceptionId: z.string().nullable(),
  statement: z.string(),
  task: z.object({
    kind: z.enum(["solve", "expand", "factor", "evaluate"]),
    equation: z.string().nullable(),
    expression: z.string().nullable(),
    variable: z.string().nullable(),
    round: z.number().nullable(),
  }),
  parameters: z.array(
    z.object({
      name: z.string(),
      ranges: z.array(z.object({ min: z.number(), max: z.number() })),
      exclude: z.array(z.number()),
    }),
  ),
  constraints: z.array(z.string()),
  steps: z.array(z.string()),
});
export const aiProposalsSchema = z.object({ proposals: z.array(aiProposal) });
export type AiProposal = z.infer<typeof aiProposal>;

/** Contenu d'une intention proposée, au format des exercices de l'organisation. */
export interface ProposedIntent {
  notionId: NotionId;
  objective: string;
  misconceptionId: MisconceptionId | null;
  statement: string;
  task: ExerciseTask;
  parameters: ParameterSpec[];
  constraints: string[];
  steps: string[];
  /** Jamais fournie par l'IA : la réponse est calculée par services/math. */
  expected: null;
  /** Énoncés vérifiés, un par niveau (1 à 3). */
  samples: string[];
}

export type RejectionReason =
  | "invalid_format"
  | "duplicate"
  | "no_valid_parameters"
  | "check_failed"
  | "unknown_placeholder"
  | "math_unavailable";

export interface RejectedProposal {
  objective: string | null;
  reason: RejectionReason;
  /** Précision lisible par l'équipe (champ fautif, raison du calcul). */
  detail: string | null;
}

const text = (max: number) => z.string().trim().min(1).max(max);
const strictContent = z.object({
  objective: text(300),
  statement: text(1000),
  task: exerciseTaskSchema,
  parameters: z.array(parameterSpecSchema).min(1).max(10),
  constraints: z.array(text(300)).max(10),
  steps: z.array(text(1000)).max(10),
});

/** La tâche souple du modèle, ramenée à la tâche du domaine (champs de son genre seulement). */
function toTask(raw: AiProposal["task"]): unknown {
  switch (raw.kind) {
    case "solve":
      return { kind: raw.kind, equation: raw.equation, variable: raw.variable };
    case "expand":
    case "factor":
      return { kind: raw.kind, expression: raw.expression };
    case "evaluate":
      return raw.round === null
        ? { kind: raw.kind, expression: raw.expression }
        : { kind: raw.kind, expression: raw.expression, round: raw.round };
  }
}

/** Champ mathématique de la tâche (sert à repérer les doublons). */
const mathOf = (task: ExerciseTask) =>
  task.kind === "solve"
    ? `${task.kind}:${task.equation}:${task.variable}`
    : `${task.kind}:${task.expression}`;

/**
 * Contrôle de forme d'une proposition : schémas du domaine, noms de
 * paramètres distincts, inconnue qui n'est pas un paramètre, idée fausse de
 * la notion. Ne vérifie pas les mathématiques (c'est le rôle de services/math).
 */
export function parseProposal(
  raw: AiProposal,
  notion: Pick<NotionDemand, "notionId" | "misconceptions">,
): Result<Omit<ProposedIntent, "samples">, string> {
  const parsed = strictContent.safeParse({
    objective: raw.objective,
    statement: raw.statement,
    task: toTask(raw.task),
    parameters: raw.parameters,
    constraints: raw.constraints,
    steps: raw.steps,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return err(
      issue ? `${issue.path.join(".")} : ${issue.message}` : "format invalide",
    );
  }
  const content = parsed.data;
  // L'objectif est lu tel quel par le prof : pas d'emplacement à remplir.
  if (/[{}]/.test(content.objective))
    return err("objective : pas d'emplacement entre accolades");
  const names = content.parameters.map((p) => p.name);
  if (new Set(names).size !== names.length)
    return err("parameters : noms en double");
  if (content.task.kind === "solve" && names.includes(content.task.variable))
    return err("task.variable : l'inconnue ne peut pas être un paramètre");
  // Une idée fausse inconnue de la notion n'est pas inventée : l'exercice reste sans cible.
  const misconceptionId =
    notion.misconceptions.find((m) => m.id === raw.misconceptionId)?.id ?? null;
  return ok({
    notionId: notion.notionId,
    objective: content.objective,
    misconceptionId,
    statement: content.statement,
    task: content.task,
    parameters: content.parameters,
    constraints: content.constraints,
    steps: content.steps,
    expected: null,
  });
}

const SYSTEM_PROMPT = [
  "Tu aides un professeur à préparer la banque d'exercices de la semaine.",
  "Tu proposes des intentions d'exercices PARAMÉTRÉES : un énoncé modèle avec des emplacements, une tâche mathématique, des plages de paramètres entiers par niveau. Un service de calcul (SymPy) tire les valeurs, calcule la réponse et vérifie chaque exercice : tu ne calcules jamais de réponse et tu ne l'écris nulle part.",
  "",
  "Format de chaque proposition :",
  "- objective : ce que l'exercice évalue, en une phrase.",
  "- misconceptionId : l'identifiant d'une idée fausse listée que l'exercice aide à corriger, ou null.",
  "- task.kind : solve (résoudre une équation : equation et variable), expand (développer : expression), factor (factoriser : expression), evaluate (calculer : expression, round = nombre de décimales attendues ou null pour une valeur exacte). Les champs qui ne servent pas à ce genre valent null.",
  "- equation / expression : syntaxe SymPy, avec les paramètres par leur nom (ex. a*x + b = c, k*(x + a), sqrt(a**2 + b**2)). Multiplication explicite avec *, puissance avec **. variable : une seule lettre, qui n'est pas un paramètre.",
  "- parameters : noms en lettres minuscules sans chiffre (a, b, k, cote…), jamais sqrt, abs, mod, pi, ni un mot-clé Python. ranges : une plage {min, max} d'entiers par niveau, du plus simple (niveau 1) au plus exigeant (niveau 3). exclude : valeurs interdites (ex. 0 pour un coefficient).",
  "- constraints : conditions SymPy sur les paramètres pour que l'exercice ait une réponse propre (ex. Ne(a, 0), Eq(Mod(c - b, a), 0) pour une solution entière). Liste vide si rien n'est nécessaire.",
  "- statement : énoncé adressé à l'élève, en tutoyant, avec des emplacements entre accolades : {equation} ou {expression} (le champ de la tâche, rendu) et {nom} pour un paramètre. Il ne contient jamais la réponse.",
  "- steps : 1 à 4 étapes de résolution, mêmes emplacements, qui guident sans donner le résultat final.",
  "",
  "Exemple :",
  JSON.stringify({
    objective: "Résoudre une équation du premier degré de la forme ax + b = c.",
    misconceptionId: null,
    statement: "Résous l'équation {equation}.",
    task: {
      kind: "solve",
      equation: "a*x + b = c",
      variable: "x",
      expression: null,
      round: null,
    },
    parameters: [
      {
        name: "a",
        ranges: [
          { min: 2, max: 5 },
          { min: 3, max: 9 },
          { min: 6, max: 15 },
        ],
        exclude: [],
      },
      {
        name: "b",
        ranges: [
          { min: 1, max: 9 },
          { min: -20, max: 20 },
          { min: -50, max: 50 },
        ],
        exclude: [0],
      },
      {
        name: "c",
        ranges: [
          { min: 1, max: 40 },
          { min: -40, max: 60 },
          { min: -100, max: 100 },
        ],
        exclude: [],
      },
    ],
    constraints: ["Eq(Mod(c - b, a), 0)"],
    steps: [
      "Retire {b} des deux membres de l'équation.",
      "Divise les deux membres par {a}.",
    ],
  }),
  "",
  "L'exemple montre le format : ne le recopie pas. Varie les exercices (forme de la tâche, difficulté, idée fausse visée) et reste fidèle à la notion et au programme. Si la notion ne se travaille pas avec ces quatre genres de tâches, renvoie une liste vide.",
].join("\n");

function userPrompt(notion: NotionDemand, count: number): string {
  const c = notion.counts;
  return [
    `Programme : ${notion.context}`,
    `Notion : ${notion.name}`,
    notion.description ? `Description : ${notion.description}` : null,
    `Élèves des classes : ${c.needs_work} à travailler, ${c.in_progress} en cours, ${c.not_seen} pas encore vue, ${c.mastered} maîtrisée.`,
    notion.misconceptions.length > 0
      ? [
          "Idées fausses de la notion (identifiant : description, élèves concernés) :",
          ...notion.misconceptions.map(
            (m) => `- ${m.id} : ${m.description} (${m.learners})`,
          ),
        ].join("\n")
      : "Aucune idée fausse répertoriée pour cette notion.",
    notion.existingObjectives.length > 0
      ? [
          "Déjà dans la banque (ne les refais pas) :",
          ...notion.existingObjectives.map((o) => `- ${o}`),
        ].join("\n")
      : null,
    `Propose ${count} exercice${count > 1 ? "s" : ""} différent${count > 1 ? "s" : ""}.`,
  ]
    .filter((l) => l !== null)
    .join("\n");
}

const REASONS: Record<GenerateError["kind"], RejectionReason> = {
  no_valid_parameters: "no_valid_parameters",
  check_failed: "check_failed",
  unknown_placeholder: "unknown_placeholder",
  unavailable: "math_unavailable",
};

function describeFailure(error: GenerateError & { level: number }): string {
  switch (error.kind) {
    case "check_failed":
      return `niveau ${error.level} : ${error.reason}`;
    case "unknown_placeholder":
      return `niveau ${error.level} : emplacement {${error.name}} inconnu`;
    case "no_valid_parameters":
      return `niveau ${error.level} : aucun jeu de paramètres ne convient`;
    case "unavailable":
      return error.message;
  }
}

/**
 * Propositions de l'IA pour une notion : la sortie du modèle est contrôlée
 * par Zod, puis chaque proposition est vérifiée par services/math à chaque
 * niveau (même chemin que la validation d'un exercice de prof). Seules les
 * propositions vérifiées sont renvoyées ; les autres sont listées avec leur
 * raison. Une erreur de l'IA (indisponible, sortie illisible) est renvoyée telle quelle.
 */
export async function proposeExercises(input: {
  ai: Pick<AiGateway, "generateObject">;
  verifier: MathVerifier;
  notion: NotionDemand;
  count: number;
  context: AiContext;
  /** Graine des échantillons de vérification. */
  seed?: number;
}): Promise<
  Result<{ accepted: ProposedIntent[]; rejected: RejectedProposal[] }, AiError>
> {
  const { notion, verifier } = input;
  const count = Math.max(0, Math.min(input.count, PROPOSALS_PER_NOTION));
  if (count === 0) return ok({ accepted: [], rejected: [] });
  const response = await input.ai.generateObject(
    {
      task: "exercise.propose",
      context: input.context,
      // Pas de température : avec une sortie structurée, OpenRouter exige que le
      // modèle accepte chaque paramètre, et certains modèles la refusent.
      maxTokens: 4000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt(notion, count) },
      ],
    },
    aiProposalsSchema,
    "propositions_exercices",
  );
  if (!response.ok) return response;

  const accepted: ProposedIntent[] = [];
  const rejected: RejectedProposal[] = [];
  const seen = new Set<string>();
  // Au-delà du nombre demandé, le surplus est ignoré (plafond de la banque).
  for (const raw of response.value.object.proposals.slice(0, count)) {
    const objective = raw.objective.trim().slice(0, 300) || null;
    const parsed = parseProposal(raw, notion);
    if (!parsed.ok) {
      rejected.push({
        objective,
        reason: "invalid_format",
        detail: parsed.error,
      });
      continue;
    }
    const key = mathOf(parsed.value.task);
    if (seen.has(key)) {
      rejected.push({ objective, reason: "duplicate", detail: null });
      continue;
    }
    seen.add(key);
    const samples = await validateIntent(parsed.value, verifier, input.seed);
    if (!samples.ok) {
      rejected.push({
        objective,
        reason: REASONS[samples.error.kind],
        detail: describeFailure(samples.error),
      });
      continue;
    }
    accepted.push({
      ...parsed.value,
      samples: samples.value.map((s) => s.statement),
    });
  }
  return ok({ accepted, rejected });
}

export interface NotionProposals {
  notion: NotionDemand;
  accepted: ProposedIntent[];
  rejected: RejectedProposal[];
  /** L'IA n'a pas répondu pour cette notion (les autres notions restent valables). */
  error: AiError | null;
}

/**
 * Passage hebdomadaire : choisit les notions de la semaine, puis demande à
 * l'IA ses propositions pour chacune (en parallèle) et les fait vérifier.
 */
export async function proposeWeeklyBank(input: {
  ai: Pick<AiGateway, "generateObject">;
  verifier: MathVerifier;
  demands: readonly NotionDemand[];
  context: AiContext;
  maxNotions?: number;
  seed?: number;
}): Promise<NotionProposals[]> {
  const notions = pickWeeklyNotions(input.demands, {
    ...(input.maxNotions === undefined ? {} : { maxNotions: input.maxNotions }),
  });
  return Promise.all(
    notions.map(async (notion): Promise<NotionProposals> => {
      const result = await proposeExercises({
        ai: input.ai,
        verifier: input.verifier,
        notion,
        count: PROPOSALS_PER_NOTION - notion.alreadyProposed,
        context: input.context,
        ...(input.seed === undefined ? {} : { seed: input.seed }),
      });
      return result.ok
        ? { notion, ...result.value, error: null }
        : { notion, accepted: [], rejected: [], error: result.error };
    }),
  );
}
