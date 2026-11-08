'use client';

import { motion, type Variants } from 'motion/react';
import { forwardRef } from 'react';
import { ARRIVE, RETURN_TRANSITION } from '../motion/tokens';
import { AnimatedGlyph } from './animated-glyph';
import type { AnimatedIconHandle, AnimatedIconProps } from './icon';

const FRAME_REST =
  'M40,56H216V184a8,8,0,0,1-8,8H168a8,8,0,0,1-8-8V160H96V208a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8Z';
const FRAME_GROWN =
  'M40,56H216V184a8,8,0,0,1-8,8H168a8,8,0,0,1-8-8V208H96V208a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8Z';
const SEP_L_REST = 'M96,56V160';
const SEP_L_GROWN = 'M96,56V208';
const SEP_R = 'M160,56V184';
const DIVIDERS = 'M40,120H96M160,120H216';

const times = [0, 0.28, 0.58, 1];
const frame: Variants = {
  normal: { d: FRAME_REST, transition: RETURN_TRANSITION },
  animate: {
    d: [FRAME_REST, FRAME_GROWN, FRAME_GROWN, FRAME_REST],
    transition: { duration: 0.55, ease: ARRIVE, times },
  },
};
const separator: Variants = {
  normal: { d: SEP_L_REST, transition: RETURN_TRANSITION },
  animate: {
    d: [SEP_L_REST, SEP_L_GROWN, SEP_L_GROWN, SEP_L_REST],
    transition: { duration: 0.55, ease: ARRIVE, times },
  },
};

export const KanbanIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  function KanbanIcon(props, ref) {
    return (
      <AnimatedGlyph ref={ref} {...props}>
        <motion.path d={FRAME_REST} variants={frame} />
        <motion.path d={SEP_L_REST} variants={separator} />
        <path d={SEP_R} />
        <path d={DIVIDERS} />
      </AnimatedGlyph>
    );
  },
);
