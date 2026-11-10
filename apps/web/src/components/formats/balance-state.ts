// État de la balance à équations (manipulable). Chaque geste s'applique aux
// DEUX plateaux, comme une transformation d'équation ; un geste impossible
// sur une vraie balance (retirer plus qu'il n'y a, diviser sans partage
// exact) est refusé, sans rien changer.

export interface Side {
  /** Nombre de boîtes « inconnue ». */
  coefficient: number;
  /** Poids connus, en unités. */
  constant: number;
}

export interface BalanceState {
  left: Side;
  right: Side;
  history: { left: Side; right: Side }[];
}

export type BalanceAction =
  | { type: "add_units"; n: number }
  | { type: "remove_units"; n: number }
  | { type: "remove_unknowns"; n: number }
  | { type: "divide"; n: number }
  | { type: "undo" }
  | { type: "reset" };

/** Au-delà, la balance ne se dessine plus lisiblement. */
export const MAX_UNITS = 200;

export function initialBalance(left: Side, right: Side): BalanceState {
  return { left, right, history: [] };
}

function apply(
  state: BalanceState,
  left: Side,
  right: Side,
): { state: BalanceState; ok: boolean } {
  return {
    ok: true,
    state: {
      left,
      right,
      history: [...state.history, { left: state.left, right: state.right }],
    },
  };
}

/** Applique un geste ; `ok` est faux si le geste est impossible. */
export function balanceStep(
  state: BalanceState,
  action: BalanceAction,
): { state: BalanceState; ok: boolean } {
  const { left, right } = state;
  const refuse = { state, ok: false };
  switch (action.type) {
    case "add_units": {
      const n = action.n;
      if (n < 1 || Math.max(left.constant, right.constant) + n > MAX_UNITS)
        return refuse;
      return apply(
        state,
        { ...left, constant: left.constant + n },
        { ...right, constant: right.constant + n },
      );
    }
    case "remove_units": {
      const n = action.n;
      if (n < 1 || left.constant < n || right.constant < n) return refuse;
      return apply(
        state,
        { ...left, constant: left.constant - n },
        { ...right, constant: right.constant - n },
      );
    }
    case "remove_unknowns": {
      const n = action.n;
      if (n < 1 || left.coefficient < n || right.coefficient < n) return refuse;
      return apply(
        state,
        { ...left, coefficient: left.coefficient - n },
        { ...right, coefficient: right.coefficient - n },
      );
    }
    case "divide": {
      const n = action.n;
      const values = [
        left.coefficient,
        left.constant,
        right.coefficient,
        right.constant,
      ];
      if (n < 2 || values.some((v) => v % n !== 0)) return refuse;
      return apply(
        state,
        { coefficient: left.coefficient / n, constant: left.constant / n },
        { coefficient: right.coefficient / n, constant: right.constant / n },
      );
    }
    case "undo": {
      const previous = state.history.at(-1);
      if (!previous) return refuse;
      return {
        ok: true,
        state: { ...previous, history: state.history.slice(0, -1) },
      };
    }
    case "reset": {
      const first = state.history[0];
      if (!first) return refuse;
      return { ok: true, state: { ...first, history: [] } };
    }
  }
}

/** L'inconnue est seule sur un plateau, face à des poids seulement. */
export function isIsolated(state: BalanceState): boolean {
  const alone = (s: Side) => s.coefficient === 1 && s.constant === 0;
  const weights = (s: Side) => s.coefficient === 0;
  return (
    (alone(state.left) && weights(state.right)) ||
    (alone(state.right) && weights(state.left))
  );
}

/** Écriture de l'équation que représente la balance (ex. « 3x + 5 = 20 »). */
export function equationOf(state: BalanceState, variable: string): string {
  const side = (s: Side) => {
    const parts: string[] = [];
    if (s.coefficient > 0)
      parts.push(
        s.coefficient === 1 ? variable : `${s.coefficient}${variable}`,
      );
    if (s.constant > 0 || parts.length === 0) parts.push(String(s.constant));
    return parts.join(" + ");
  };
  return `${side(state.left)} = ${side(state.right)}`;
}
