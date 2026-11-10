import type { Transition } from "motion/react";

export type Bezier = [number, number, number, number];

export const SWEEP: Bezier = [0.65, 0, 0.35, 1];
export const ARRIVE: Bezier = [0.16, 1, 0.3, 1];
export const RETURN: Bezier = [0.4, 0, 0.2, 1];

export const DUR = {
  instant: 0.12,
  nav: 0.16,
  fast: 0.2,
  state: 0.22,
  panel: 0.24,
  base: 0.32,
  slow: 0.5,
} as const;

export const springPop: Transition = {
  type: "spring",
  stiffness: 520,
  damping: 17,
  mass: 0.7,
};
export const springSettle: Transition = {
  type: "spring",
  stiffness: 180,
  damping: 20,
  mass: 1,
};

export const RETURN_TRANSITION: Transition = {
  duration: DUR.base,
  ease: RETURN,
};

export function staged(index: number, step = 0.09): number {
  return index * step;
}

export const CSS_EASE = {
  arrive: "cubic-bezier(0.16, 1, 0.3, 1)",
  return: "cubic-bezier(0.4, 0, 0.2, 1)",
  sweep: "cubic-bezier(0.65, 0, 0.35, 1)",
} as const;
