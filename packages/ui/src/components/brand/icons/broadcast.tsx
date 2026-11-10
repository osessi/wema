"use client";

import { motion, type Variants } from "motion/react";
import { forwardRef } from "react";
import { ARRIVE, RETURN_TRANSITION, staged } from "../motion";
import { AnimatedGlyph } from "./animated-glyph";
import { type AnimatedIconHandle, type AnimatedIconProps, at } from "./icon";

const CENTRE = at(128, 128);
function arc(r: number, side: 1 | -1, a: number): string {
  const rad = (a * Math.PI) / 180;
  const x = 128 + side * r * Math.cos(rad);
  const y1 = 128 - r * Math.sin(rad);
  const y2 = 128 + r * Math.sin(rad);
  const sweep = side === 1 ? 1 : 0;
  return `M${x.toFixed(2)},${y1.toFixed(2)}A${r},${r},0,0,${sweep},${x.toFixed(2)},${y2.toFixed(2)}`;
}
const INNER = `${arc(72, 1, 42)}${arc(72, -1, 42)}`;
const OUTER = `${arc(104, 1, 42)}${arc(104, -1, 42)}`;

const ring = (i: number, peak: number): Variants => ({
  normal: { scale: 1, opacity: 1, transition: RETURN_TRANSITION },
  animate: {
    scale: [1, peak, 1],
    opacity: [1, 0.7, 1],
    transition: {
      duration: 0.5,
      ease: ARRIVE,
      times: [0, 0.4, 1],
      delay: staged(i, 0.06),
    },
  },
});
const inner = ring(0, 1.28);
const outer = ring(1, 1.18);

export const BroadcastIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  function BroadcastIcon(props, ref) {
    return (
      <AnimatedGlyph ref={ref} overflow="visible" {...props}>
        <circle cx="128" cy="128" r="32" />
        <motion.path d={INNER} variants={inner} style={CENTRE} />
        <motion.path d={OUTER} variants={outer} style={CENTRE} />
      </AnimatedGlyph>
    );
  },
);
