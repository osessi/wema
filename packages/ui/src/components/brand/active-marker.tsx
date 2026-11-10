"use client";

import { LayoutGroup, MotionConfig, motion } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

/**
 * Groupe de marqueurs actifs : un seul marqueur par `layoutId` glisse d'une
 * entrée à l'autre. Respecte `prefers-reduced-motion` (le marqueur saute).
 */
export function ActiveMarkerGroup({
  id,
  children,
}: {
  readonly id?: string | undefined;
  readonly children: ReactNode;
}) {
  return (
    <MotionConfig reducedMotion="user">
      {id === undefined ? (
        <LayoutGroup>{children}</LayoutGroup>
      ) : (
        <LayoutGroup id={id}>{children}</LayoutGroup>
      )}
    </MotionConfig>
  );
}

/**
 * Fond ou barre qui glisse vers l'entrée active d'un menu. À poser dans
 * l'entrée active seulement, en position absolue ; décoratif.
 */
export function ActiveMarker({
  layoutId,
  className,
}: {
  readonly layoutId: string;
  readonly className?: string | undefined;
}) {
  return (
    <motion.span
      aria-hidden="true"
      layoutId={layoutId}
      className={cn("pointer-events-none absolute", className)}
      transition={{ type: "spring", stiffness: 520, damping: 40, mass: 0.8 }}
    />
  );
}
