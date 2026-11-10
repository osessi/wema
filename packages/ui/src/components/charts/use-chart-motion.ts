"use client";

import { useReducedMotion } from "motion/react";

/**
 * Entrée sobre (600 ms, ease-out), coupée si l'utilisateur réduit les
 * animations. À étaler sur une série Recharts.
 */
export function useChartMotion(delay = 0) {
  const reduced = useReducedMotion();
  return reduced
    ? ({ isAnimationActive: false } as const)
    : ({
        isAnimationActive: true,
        animationBegin: delay,
        animationDuration: 600,
        animationEasing: "ease-out",
      } as const);
}
