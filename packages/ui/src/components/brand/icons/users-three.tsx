"use client";

import { motion, type Variants } from "motion/react";
import { forwardRef } from "react";
import { RETURN_TRANSITION, staged } from "../motion";
import { AnimatedGlyph } from "./animated-glyph";
import { type AnimatedIconHandle, type AnimatedIconProps, at } from "./icon";

const HEAD_L = "M64,120A32,32,0,1,1,95,80";
const HEAD_R = "M161,80a32,32,0,1,1,31,40";
const HEAD_C = { cx: 128, cy: 144, r: 40 };
const SH_L = "M16,144a59.91,59.91,0,0,1,48-24";
const SH_R = "M192,120a59.91,59.91,0,0,1,48,24";
const SH_C = "M72,216a65,65,0,0,1,112,0";
const NECK_L = at(64, 120);
const NECK_C = at(128, 184);
const NECK_R = at(192, 120);

const wave = (i: number, tilt: number): Variants => ({
  normal: { rotate: 0, transition: RETURN_TRANSITION },
  animate: {
    rotate: [0, tilt, tilt, -tilt, -tilt, 0],
    transition: {
      duration: 0.6,
      ease: "easeInOut",
      times: [0, 0.18, 0.32, 0.58, 0.7, 1],
      delay: staged(i),
    },
  },
});
const waveL = wave(0, 17);
const waveC = wave(1, 14);
const waveR = wave(2, 17);

export const UsersThreeIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  function UsersThreeIcon(props, ref) {
    return (
      <AnimatedGlyph ref={ref} {...props}>
        <motion.path d={HEAD_L} variants={waveL} style={NECK_L} />
        <path d={SH_L} />
        <motion.circle
          cx={HEAD_C.cx}
          cy={HEAD_C.cy}
          r={HEAD_C.r}
          variants={waveC}
          style={NECK_C}
        />
        <path d={SH_C} />
        <motion.path d={HEAD_R} variants={waveR} style={NECK_R} />
        <path d={SH_R} />
      </AnimatedGlyph>
    );
  },
);
