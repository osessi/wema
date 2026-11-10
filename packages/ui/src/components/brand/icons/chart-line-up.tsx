"use client";

import { motion, type Variants } from "motion/react";
import { forwardRef } from "react";
import { ARRIVE, RETURN_TRANSITION } from "../motion";
import { AnimatedGlyph } from "./animated-glyph";
import type { AnimatedIconHandle, AnimatedIconProps } from "./icon";

const AXES = "M32,48V208H224";
const LINE_REST = "M40,180L96,124L128,156L200,84";
const LINE_LOW = "M40,180L96,152L128,176L200,116";
const ARROW = "M160,84H200V124";

const times = [0, 0.32, 0.55, 1];
const line: Variants = {
  normal: { d: LINE_REST, transition: RETURN_TRANSITION },
  animate: {
    d: [LINE_REST, LINE_LOW, LINE_LOW, LINE_REST],
    transition: { duration: 0.6, ease: ["easeInOut", "linear", ARRIVE], times },
  },
};
const arrow: Variants = {
  normal: { y: 0, transition: RETURN_TRANSITION },
  animate: {
    y: [0, 32, 32, 0],
    transition: { duration: 0.6, ease: ["easeInOut", "linear", ARRIVE], times },
  },
};

export const ChartLineUpIcon = forwardRef<
  AnimatedIconHandle,
  AnimatedIconProps
>(function ChartLineUpIcon(props, ref) {
  return (
    <AnimatedGlyph ref={ref} {...props}>
      <path d={AXES} />
      <motion.path d={LINE_REST} variants={line} />
      <motion.path d={ARROW} variants={arrow} />
    </AnimatedGlyph>
  );
});
