import type { ExerciseTask } from "@wema/domain";

// Gabarits de figure (format « schéma ») : une figure est construite à partir
// des paramètres de la variante, jamais à partir de la matière (AGENTS.md,
// règle 6). Le registre associe chaque gabarit à des FORMES de tâche (le type
// de tâche et l'écriture de sa formule) : c'est la donnée de l'exercice qui
// décide, pas un test sur la notion. Ajouter un gabarit = ajouter une entrée.
// Une figure ne montre jamais la réponse : la grandeur cherchée est « ? ».

/** Figure prête à dessiner (SVG côté web). */
export type FigureSpec =
  | {
      kind: "balance";
      variable: string;
      /** Membre de gauche : `coefficient` fois l'inconnue, plus `constant`. */
      left: { coefficient: number; constant: number };
      right: { coefficient: number; constant: number };
    }
  | {
      kind: "right_triangle";
      /** Côtés de l'angle droit et hypoténuse ; null : la longueur cherchée. */
      legs: [number | null, number | null];
      hypotenuse: number | null;
    }
  | {
      kind: "number_line";
      start: number;
      /** Déplacement (négatif : vers la gauche) ; l'arrivée est cherchée. */
      step: number;
    }
  | { kind: "square"; side: number };

export type FigureKind = FigureSpec["kind"];

/** Figures qui existent aussi en manipulable interactif (aide sur la page d'exercice). */
export const MANIPULABLE_FIGURES: readonly FigureKind[] = [
  "balance",
  "right_triangle",
];

type Values = Readonly<Record<string, number>>;

interface FigureTemplate {
  key: string;
  /** Type de tâche concerné. */
  task: ExerciseTask["kind"];
  /**
   * Écritures reconnues de la formule (espaces ignorés) : `{v}` est
   * l'inconnue, toute autre `{lettre}` un paramètre de l'exercice.
   */
  forms: readonly string[];
  /** Construit la figure à partir des valeurs liées ; null si elle n'a pas de sens. */
  build: (v: Values, variable: string) => FigureSpec | null;
}

const isCount = (n: number | undefined, max: number): n is number =>
  n !== undefined && Number.isInteger(n) && n >= 0 && n <= max;

/** Balance : coefficient et poids positifs seulement (un poids négatif n'a pas de sens sur un plateau). */
const balance =
  (fixed: Partial<Record<"p" | "q" | "s", number>> = {}) =>
  (v: Values, variable: string): FigureSpec | null => {
    const p = fixed.p ?? v.p;
    const q = fixed.q ?? v.q ?? 0;
    const s = fixed.s ?? v.s ?? 0;
    const r = v.r;
    if (!isCount(p, 12) || p === 0 || !isCount(q, 100) || !isCount(r, 200))
      return null;
    if (!isCount(s, 12)) return null;
    return {
      kind: "balance",
      variable,
      left: { coefficient: p, constant: q },
      right: { coefficient: s, constant: r },
    };
  };

/** Registre des gabarits de figure, par forme de tâche. */
export const FIGURE_TEMPLATES: readonly FigureTemplate[] = [
  {
    key: "balance.linear",
    task: "solve",
    forms: ["{p}*{v}+{q}={r}", "{q}+{p}*{v}={r}"],
    build: balance(),
  },
  {
    key: "balance.product",
    task: "solve",
    forms: ["{p}*{v}={r}"],
    build: balance({ q: 0 }),
  },
  {
    key: "balance.sum",
    task: "solve",
    forms: ["{v}+{q}={r}", "{q}+{v}={r}"],
    build: balance({ p: 1 }),
  },
  {
    key: "balance.both_sides",
    task: "solve",
    forms: ["{p}*{v}+{q}={s}*{v}+{r}"],
    build: (v, variable) =>
      (v.p ?? 0) > (v.s ?? 0) ? balance()(v, variable) : null,
  },
  {
    key: "right_triangle.hypotenuse",
    task: "evaluate",
    forms: ["sqrt({a}**2+{b}**2)"],
    build: (v) =>
      v.a !== undefined && v.b !== undefined && v.a > 0 && v.b > 0
        ? { kind: "right_triangle", legs: [v.a, v.b], hypotenuse: null }
        : null,
  },
  {
    key: "right_triangle.leg",
    task: "evaluate",
    forms: ["sqrt({c}**2-{a}**2)"],
    build: (v) =>
      v.a !== undefined && v.c !== undefined && v.c > v.a && v.a > 0
        ? { kind: "right_triangle", legs: [v.a, null], hypotenuse: v.c }
        : null,
  },
  {
    key: "number_line.sum",
    task: "evaluate",
    forms: ["{a}+{b}", "{a}+({b})"],
    build: (v) => numberLine(v, 1),
  },
  {
    key: "number_line.difference",
    task: "evaluate",
    forms: ["{a}-{b}", "{a}-({b})"],
    build: (v) => numberLine(v, -1),
  },
  {
    key: "square.area",
    task: "evaluate",
    forms: ["{a}**2"],
    build: (v) =>
      v.a !== undefined && v.a > 0 ? { kind: "square", side: v.a } : null,
  },
];

function numberLine(v: Values, direction: 1 | -1): FigureSpec | null {
  if (v.a === undefined || v.b === undefined) return null;
  const step = direction * v.b;
  return Math.abs(v.a) <= 100 && Math.abs(step) <= 100 && step !== 0
    ? { kind: "number_line", start: v.a, step }
    : null;
}

/** Formule de la tâche, celle que le gabarit reconnaît. */
function formulaOf(task: ExerciseTask): string {
  switch (task.kind) {
    case "solve":
      return task.equation;
    case "expand":
    case "factor":
    case "evaluate":
      return task.expression;
  }
}

const escapeRegex = (s: string) => s.replace(/[.*+?^$()|[\]\\]/g, "\\$&");

/**
 * Lie une forme à une formule : renvoie, pour chaque emplacement, le nom du
 * paramètre trouvé à sa place (ou null si la formule n'a pas cette forme).
 */
export function matchForm(
  form: string,
  formula: string,
  variable: string | null,
): Record<string, string> | null {
  const slots: string[] = [];
  const pattern = form
    .replace(/\s+/g, "")
    .split(/(\{[a-z]\})/)
    .map((piece) => {
      const slot = /^\{([a-z])\}$/.exec(piece)?.[1];
      if (!slot) return escapeRegex(piece);
      slots.push(slot);
      return slot === "v" ? "([a-zA-Z])" : "([a-z]{1,12})";
    })
    .join("");
  const found = new RegExp(`^${pattern}$`).exec(formula.replace(/\s+/g, ""));
  if (!found) return null;
  const bound: Record<string, string> = {};
  for (const [i, slot] of slots.entries()) {
    const name = found[i + 1];
    if (name === undefined) return null;
    if (slot === "v" && name !== variable) return null;
    // Un même emplacement répété doit désigner le même paramètre.
    if (bound[slot] !== undefined && bound[slot] !== name) return null;
    bound[slot] = name;
  }
  return bound;
}

/**
 * Figure d'une variante : le premier gabarit dont une forme correspond à la
 * tâche, construit avec les valeurs des paramètres. Null : pas de schéma pour
 * cet exercice (le format « schéma » n'est alors pas proposé).
 */
export function figureFor(
  task: ExerciseTask,
  parameters: Readonly<Record<string, number>>,
): FigureSpec | null {
  const variable = task.kind === "solve" ? task.variable : null;
  const formula = formulaOf(task);
  for (const template of FIGURE_TEMPLATES) {
    if (template.task !== task.kind) continue;
    for (const form of template.forms) {
      const bound = matchForm(form, formula, variable);
      if (!bound) continue;
      const values: Record<string, number> = {};
      let complete = true;
      for (const [slot, name] of Object.entries(bound)) {
        if (slot === "v") continue;
        const value = parameters[name];
        if (value === undefined) complete = false;
        else values[slot] = value;
      }
      if (!complete) continue;
      const figure = template.build(values, variable ?? "x");
      if (figure) return figure;
    }
  }
  return null;
}
