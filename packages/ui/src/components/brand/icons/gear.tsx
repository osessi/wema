"use client";

import { motion, type Variants } from "motion/react";
import { forwardRef } from "react";
import { ARRIVE, RETURN_TRANSITION } from "../motion";
import { AnimatedGlyph } from "./animated-glyph";
import { type AnimatedIconHandle, type AnimatedIconProps, at } from "./icon";

const COG =
  "M41.43,178.09A99.14,99.14,0,0,1,31.36,153.8l16.78-21a81.59,81.59,0,0,1,0-9.64l-16.77-21a99.43,99.43,0,0,1,10.05-24.3l26.71-3a81,81,0,0,1,6.81-6.81l3-26.7A99.14,99.14,0,0,1,102.2,31.36l21,16.78a81.59,81.59,0,0,1,9.64,0l21-16.77a99.43,99.43,0,0,1,24.3,10.05l3,26.71a81,81,0,0,1,6.81,6.81l26.7,3a99.14,99.14,0,0,1,10.07,24.29l-16.78,21a81.59,81.59,0,0,1,0,9.64l16.77,21a99.43,99.43,0,0,1-10,24.3l-26.71,3a81,81,0,0,1-6.81,6.81l-3,26.7a99.14,99.14,0,0,1-24.29,10.07l-21-16.78a81.59,81.59,0,0,1-9.64,0l-21,16.77a99.43,99.43,0,0,1-24.3-10l-3-26.71a81,81,0,0,1-6.81-6.81Z";
const CENTRE = at(128, 128);

const spinDown: Variants = {
  normal: { rotate: 360, transition: RETURN_TRANSITION },
  animate: {
    rotate: [0, 108, 198, 270, 315, 342, 353, 353, 360],
    transition: {
      duration: 0.7,
      times: [0, 0.1, 0.2, 0.31, 0.43, 0.56, 0.72, 0.86, 1],
      ease: [
        "linear",
        "linear",
        "linear",
        "linear",
        "linear",
        "easeOut",
        "linear",
        ARRIVE,
      ],
    },
  },
};

export const GearIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  function GearIcon(props, ref) {
    return (
      <AnimatedGlyph ref={ref} {...props}>
        <motion.g variants={spinDown} style={CENTRE}>
          <circle cx="128" cy="128" r="40" />
          <path d={COG} />
        </motion.g>
      </AnimatedGlyph>
    );
  },
);
