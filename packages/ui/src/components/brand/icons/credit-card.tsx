"use client";

import { motion, type Variants } from "motion/react";
import { forwardRef } from "react";
import { ARRIVE, RETURN_TRANSITION } from "../motion";
import { AnimatedGlyph } from "./animated-glyph";
import { type AnimatedIconHandle, type AnimatedIconProps, at } from "./icon";

const CARD =
  "M32,56H224a8,8,0,0,1,8,8V192a8,8,0,0,1-8,8H32a8,8,0,0,1-8-8V64A8,8,0,0,1,32,56Z";
const BAND = "M24,96H232";
const LINES = "M120,168h16M168,168h32";
const CENTRE = at(128, 128);

const swipe: Variants = {
  normal: { x: 0, rotate: 0, transition: RETURN_TRANSITION },
  animate: {
    x: [0, 18, 0],
    rotate: [0, -2.5, 0],
    transition: {
      duration: 0.5,
      ease: ["easeOut", ARRIVE],
      times: [0, 0.4, 1],
    },
  },
};
const trail: Variants = {
  normal: { x: 0, transition: RETURN_TRANSITION },
  animate: {
    x: [0, 8, 0],
    transition: {
      duration: 0.5,
      ease: ["easeOut", ARRIVE],
      times: [0, 0.5, 1],
    },
  },
};

export const CreditCardIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  function CreditCardIcon(props, ref) {
    return (
      <AnimatedGlyph ref={ref} overflow="visible" {...props}>
        <motion.g variants={swipe} style={CENTRE}>
          <path d={CARD} />
          <path d={BAND} />
          <motion.path d={LINES} variants={trail} />
        </motion.g>
      </AnimatedGlyph>
    );
  },
);
