import type {
  CanonicalAnswer,
  MisconceptionId,
  NotionStatus,
  TutorMode,
} from "@wema/domain";

/** Ce que le prof IA sait de la séance. Aucune donnée personnelle : on parle à « l'élève ». */
export interface TutorContext {
  mode: TutorMode;
  subjectName: string;
  /** Consignes propres à la matière, réglées par l'équipe Wema (peuvent être vides). */
  subjectInstructions: string;
  notion: { name: string; description: string };
  misconceptions: readonly { id: MisconceptionId; description: string }[];
  learner: {
    status: NotionStatus;
    /** Idées fausses encore actives chez l'élève sur cette notion (descriptions). */
    activeMisconceptions: readonly string[];
  };
  /** Exercice concerné : énoncé et étapes montrés à l'élève, réponse gardée secrète. */
  exercise: {
    statement: string;
    steps: readonly string[];
    answer: CanonicalAnswer;
  } | null;
  hintLevel: number;
}

const STATUS_TEXT: Record<NotionStatus, string> = {
  not_seen: "n'a pas encore travaillé cette notion",
  needs_work: "a encore des difficultés sur cette notion",
  in_progress: "progresse sur cette notion",
  mastered: "maîtrise bien cette notion",
};

const COMMON_RULES = [
  "Tu es le prof particulier de l'élève, bienveillant, patient et exigeant.",
  "Tu réponds toujours en français, avec des phrases courtes et simples, adaptées à un collégien ou un lycéen.",
  "Tu ne donnes JAMAIS la réponse finale d'un exercice ni le résultat d'un calcul que l'élève doit faire : tu poses des questions et tu donnes des indices.",
  "Tu termines chaque message par UNE seule question qui fait avancer l'élève.",
  "Tu ne poses aucun diagnostic sur l'élève (dyslexie, TDAH, etc.) et tu ne lui demandes aucune information personnelle.",
  "Tu restes sur la matière et la notion ; si l'élève s'en écarte, tu le ramènes gentiment au travail.",
  "Tu encourages l'effort, pas seulement le résultat.",
];

const MODE_RULES: Record<TutorMode, string[]> = {
  exercise_help: [
    "L'élève travaille sur l'exercice ci-dessous. Guide-le pas à pas, sans résoudre l'exercice à sa place.",
    "S'il propose une étape fausse, ne corrige pas directement : demande-lui de vérifier, ou pose une question qui fait apparaître l'erreur.",
  ],
  course_question: [
    "L'élève pose une question sur la notion. Explique avec un exemple simple et concret (différent de ses exercices), puis vérifie qu'il a compris par une question.",
  ],
  teach_back: [
    "Mode « explique-moi » : tu joues un élève qui ne connaît pas la notion. C'est l'élève qui t'enseigne.",
    "Pose des questions naïves mais pertinentes, demande des exemples, fais-le préciser quand c'est flou.",
    "Ne corrige pas et n'explique pas toi-même : ton rôle est de le faire expliquer.",
  ],
  oral_check: [
    "Vérification : l'élève doit expliquer comment il a trouvé sa réponse à l'exercice ci-dessous.",
    "Demande-lui de justifier chaque étape ; ne dis pas si son résultat est juste et ne donne pas la réponse.",
  ],
};

const HINT_RULES: Record<number, string> = {
  1: "Donne un premier indice léger : une question qui rappelle ce qu'on cherche ou ce que dit l'énoncé.",
  2: "Donne un indice de méthode : rappelle la règle ou la propriété à utiliser, sans l'appliquer aux nombres de l'exercice.",
  3: "Donne un indice fort : montre comment commencer la première étape avec les nombres de l'exercice, sans aller jusqu'au résultat final.",
};

/** Consigne système de la séance. La réponse attendue n'y figure jamais. */
export function systemPrompt(ctx: TutorContext): string {
  const lines = [
    ...COMMON_RULES,
    `Matière : ${ctx.subjectName}.`,
    ctx.subjectInstructions.trim()
      ? `Consignes propres à la matière : ${ctx.subjectInstructions.trim()}`
      : "",
    `Notion travaillée : ${ctx.notion.name}. ${ctx.notion.description}`,
    `Où en est l'élève : il ${STATUS_TEXT[ctx.learner.status]}.`,
    ctx.learner.activeMisconceptions.length > 0
      ? `Erreurs de raisonnement qu'il fait encore : ${ctx.learner.activeMisconceptions.join(" ; ")}. Aide-le à les dépasser sans les nommer comme des défauts.`
      : "",
    ...MODE_RULES[ctx.mode],
    ctx.exercise ? `Énoncé de l'exercice : ${ctx.exercise.statement}` : "",
    ctx.exercise && ctx.exercise.steps.length > 0
      ? `Étapes proposées à l'élève : ${ctx.exercise.steps.join(" / ")}`
      : "",
  ];
  return lines.filter((l) => l !== "").join("\n");
}

export function hintInstruction(level: number): string {
  return HINT_RULES[Math.min(Math.max(level, 1), 3)] ?? HINT_RULES[1] ?? "";
}

/** Consigne ajoutée quand une première réponse donnait la solution. */
export const REINFORCED_RULE =
  "ATTENTION : ta réponse précédente donnait la solution. Recommence sans donner aucun résultat final ni valeur de l'inconnue : pose seulement une question ou un indice.";

/** Relance sûre, quand le prof IA n'arrive pas à répondre sans donner la solution. */
export const SAFE_FALLBACK =
  "Je ne vais pas te donner la réponse, mais on va la trouver ensemble. Quelle est la toute première étape que tu ferais ?";
