import type { NotionId, VariantPlan } from "@wema/domain";

/**
 * Test de niveau (positionnement) : un court test adaptatif, avant le
 * parcours, qui estime d'emblée la maîtrise des notions d'un programme et de
 * leurs prérequis. On interroge une notion clé du graphe des prérequis : une
 * réussite laisse supposer ses prérequis acquis et fait monter, une erreur
 * laisse supposer les notions qui en dépendent à reprendre et fait descendre.
 * Fonctions pures.
 */

/** Questions au plus (environ 10 minutes). */
export const PLACEMENT_MAX_QUESTIONS = 12;
/** Questions au moins, s'il y a de quoi : au-delà du graphe, on confirme ce qui a été supposé. */
export const PLACEMENT_MIN_QUESTIONS = 8;
/** Un seul test complet par matière sur cette période, en jours. */
export const PLACEMENT_COOLDOWN_DAYS = 30;
/**
 * Forme des questions : nombres intermédiaires, sans étapes guidées ni
 * indice. Le test mesure ce que l'élève sait faire seul.
 */
export const PLACEMENT_PLAN: VariantPlan = {
  level: 2,
  scaffolded: false,
  hintLevel: 0,
};

const DAY_MS = 24 * 60 * 60 * 1000;

export interface PlacementNotion {
  id: NotionId;
  prerequisites: readonly NotionId[];
}

export interface PlacementAnswer {
  notionId: NotionId;
  correct: boolean;
}

/** Acquise · À consolider · À reprendre · Non évaluée. */
export type PlacementLevel =
  | "acquired"
  | "to_consolidate"
  | "to_review"
  | "not_assessed";

export interface PlacementEstimate {
  notionId: NotionId;
  level: PlacementLevel;
  /** « direct » : la notion a été interrogée ; « inferred » : supposé d'après le graphe. */
  source: "direct" | "inferred" | null;
  /** Notions interrogées qui fondent l'estimation (preuves). */
  evidence: readonly NotionId[];
}

/**
 * Notions du test : celles du programme, dans son ordre, précédées de leurs
 * prérequis (de proche en proche) connus hors du programme.
 */
export function placementScope(
  program: readonly PlacementNotion[],
  known: ReadonlyMap<string, PlacementNotion>,
): PlacementNotion[] {
  const inProgram = new Set(program.map((n) => n.id));
  const outside: PlacementNotion[] = [];
  const seen = new Set<string>(inProgram);
  const visit = (n: PlacementNotion) => {
    for (const p of n.prerequisites) {
      if (seen.has(p)) continue;
      seen.add(p);
      const found = known.get(p);
      if (!found) continue;
      visit(found);
      outside.push(found);
    }
  };
  for (const n of program) visit(n);
  return [...outside, ...program];
}

/** Ancêtres (prérequis de proche en proche) et descendants de chaque notion, dans le périmètre. */
function closure(scope: readonly PlacementNotion[]) {
  const ids = new Set(scope.map((n) => n.id));
  const direct = new Map<string, NotionId[]>(
    scope.map((n) => [n.id, n.prerequisites.filter((p) => ids.has(p))]),
  );
  const ancestors = new Map<string, Set<NotionId>>();
  const walk = (id: string, stack: Set<string>): Set<NotionId> => {
    const done = ancestors.get(id);
    if (done) return done;
    const result = new Set<NotionId>();
    // Le référentiel interdit les cycles ; on s'en garde quand même.
    if (stack.has(id)) return result;
    stack.add(id);
    for (const p of direct.get(id) ?? []) {
      result.add(p);
      for (const a of walk(p, stack)) result.add(a);
    }
    stack.delete(id);
    ancestors.set(id, result);
    return result;
  };
  const descendants = new Map<string, Set<NotionId>>(
    scope.map((n) => [n.id, new Set<NotionId>()]),
  );
  for (const n of scope) {
    for (const a of walk(n.id, new Set())) descendants.get(a)?.add(n.id);
  }
  return { ancestors, descendants, direct };
}

/**
 * Estimation de chaque notion du périmètre d'après les réponses :
 * - réussie, ou prérequis d'une notion réussie : acquise ;
 * - manquée, ou dépendante d'une notion manquée : à reprendre ;
 * - preuves contraires (réussie mais un prérequis manqué, ou l'inverse) : à consolider ;
 * - rien ne permet de le dire : non évaluée.
 * Si une notion a plusieurs réponses, la dernière compte.
 */
export function placementEstimates(
  scope: readonly PlacementNotion[],
  answers: readonly PlacementAnswer[],
): PlacementEstimate[] {
  const { ancestors, descendants } = closure(scope);
  const last = new Map<string, boolean>();
  for (const a of answers) last.set(a.notionId, a.correct);
  return scope.map((n) => {
    const up = [...(descendants.get(n.id) ?? [])].filter(
      (d) => last.get(d) === true,
    );
    const down = [...(ancestors.get(n.id) ?? [])].filter(
      (a) => last.get(a) === false,
    );
    const own = last.get(n.id);
    if (own === true)
      return down.length > 0
        ? estimate(n.id, "to_consolidate", "direct", [n.id, ...down])
        : estimate(n.id, "acquired", "direct", [n.id]);
    if (own === false)
      return up.length > 0
        ? estimate(n.id, "to_consolidate", "direct", [n.id, ...up])
        : estimate(n.id, "to_review", "direct", [n.id]);
    if (up.length > 0 && down.length > 0)
      return estimate(n.id, "to_consolidate", "inferred", [...up, ...down]);
    if (up.length > 0) return estimate(n.id, "acquired", "inferred", up);
    if (down.length > 0) return estimate(n.id, "to_review", "inferred", down);
    return estimate(n.id, "not_assessed", null, []);
  });
}

const estimate = (
  notionId: NotionId,
  level: PlacementLevel,
  source: PlacementEstimate["source"],
  evidence: readonly NotionId[],
): PlacementEstimate => ({ notionId, level, source, evidence });

export interface NextPlacementInput {
  scope: readonly PlacementNotion[];
  /** Notions qui ont au moins une question disponible (exercice validé). */
  askable: ReadonlySet<string>;
  answers: readonly PlacementAnswer[];
  /** Notions écartées pendant ce test (question impossible à préparer). */
  skipped?: ReadonlySet<string>;
}

/**
 * Prochaine notion à interroger, ou `null` : le test est fini.
 *
 * On interroge d'abord les notions encore incertaines (non évaluées, ou aux
 * preuves contraires sans question directe). Parmi elles, la notion clé est
 * celle qui partage le mieux les incertaines entre ses prérequis et ce qui en
 * dépend (une recherche par moitié dans le graphe) ; à égalité, la plus proche
 * d'une notion déjà interrogée (on monte juste au-dessus d'une réussite, on
 * descend juste en dessous d'une erreur), puis l'ordre du programme. Quand
 * plus rien n'est incertain et qu'il reste moins de
 * `PLACEMENT_MIN_QUESTIONS` réponses, on confirme ce qui a été supposé.
 */
export function nextPlacementNotion(
  input: NextPlacementInput,
): NotionId | null {
  const { scope, askable, answers } = input;
  if (answers.length >= PLACEMENT_MAX_QUESTIONS) return null;
  const asked = new Set<string>([
    ...answers.map((a) => a.notionId),
    ...(input.skipped ?? []),
  ]);
  const available = scope.filter((n) => askable.has(n.id) && !asked.has(n.id));
  if (available.length === 0) return null;
  const estimates = new Map(
    placementEstimates(scope, answers).map((e) => [e.notionId, e]),
  );
  const uncertain = available.filter((n) => {
    const e = estimates.get(n.id);
    return e?.level === "not_assessed" || e?.level === "to_consolidate";
  });
  const pool =
    uncertain.length > 0
      ? uncertain
      : answers.length < PLACEMENT_MIN_QUESTIONS
        ? available
        : [];
  if (pool.length === 0) return null;

  const { ancestors, descendants, direct } = closure(scope);
  const inPool = new Set(pool.map((n) => n.id));
  const count = (set: Set<NotionId> | undefined) =>
    [...(set ?? [])].filter((id) => inPool.has(id)).length;
  const distance = distances(scope, direct, answers);
  const position = new Map(scope.map((n, i) => [n.id, i]));
  const ranked = pool.map((n) => {
    const below = count(ancestors.get(n.id));
    const above = count(descendants.get(n.id));
    return {
      id: n.id,
      split: Math.min(below, above),
      reach: below + above,
      distance: distance.get(n.id) ?? Number.POSITIVE_INFINITY,
      position: position.get(n.id) ?? 0,
    };
  });
  ranked.sort(
    (a, b) =>
      b.split - a.split ||
      b.reach - a.reach ||
      a.distance - b.distance ||
      a.position - b.position ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  return ranked[0]?.id ?? null;
}

/** Distance (en arêtes du graphe, dans les deux sens) à la notion interrogée la plus proche. */
function distances(
  scope: readonly PlacementNotion[],
  direct: ReadonlyMap<string, readonly NotionId[]>,
  answers: readonly PlacementAnswer[],
): Map<string, number> {
  const neighbours = new Map<string, string[]>(scope.map((n) => [n.id, []]));
  for (const [id, prerequisites] of direct) {
    for (const p of prerequisites) {
      neighbours.get(id)?.push(p);
      neighbours.get(p)?.push(id);
    }
  }
  const result = new Map<string, number>();
  let frontier: string[] = [...new Set(answers.map((a) => a.notionId))].filter(
    (id) => neighbours.has(id),
  );
  for (const id of frontier) result.set(id, 0);
  let d = 0;
  while (frontier.length > 0) {
    d++;
    const next: string[] = [];
    for (const id of frontier)
      for (const n of neighbours.get(id) ?? [])
        if (!result.has(n)) {
          result.set(n, d);
          next.push(n);
        }
    frontier = next;
  }
  return result;
}

/** Avancement affiché : réponses données sur un total prévu (jamais moins que les réponses). */
export function placementProgress(input: {
  scope: readonly PlacementNotion[];
  askable: ReadonlySet<string>;
  answered: number;
}): { answered: number; total: number } {
  const available = input.scope.filter((n) => input.askable.has(n.id)).length;
  return {
    answered: input.answered,
    total: Math.max(
      input.answered,
      Math.min(PLACEMENT_MAX_QUESTIONS, available),
    ),
  };
}

/**
 * Date à partir de laquelle un nouveau test complet est permis dans la
 * matière (`null` : tout de suite). Évite de repasser le test à volonté.
 */
export function placementAvailableAt(
  lastCompletedAt: Date | null,
  now: Date,
): Date | null {
  if (!lastCompletedAt) return null;
  const at = new Date(
    lastCompletedAt.getTime() + PLACEMENT_COOLDOWN_DAYS * DAY_MS,
  );
  return at.getTime() > now.getTime() ? at : null;
}

/**
 * Exercices validés d'une notion, dans l'ordre où les essayer pour une
 * question du test : d'abord ceux qui évaluent la notion en général (sans
 * idée fausse ciblée), puis par identifiant (résultat stable). On passe au
 * suivant si services/math refuse de décliner le premier.
 */
export function placementIntents<
  T extends { id: string; notionId: NotionId; misconceptionId: string | null },
>(intents: readonly T[], notionId: NotionId): T[] {
  return intents
    .filter((i) => i.notionId === notionId)
    .sort(
      (a, b) =>
        Number(a.misconceptionId !== null) -
          Number(b.misconceptionId !== null) ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
}
