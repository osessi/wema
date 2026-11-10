'use client';

import { motion, type Variants } from 'motion/react';
import { forwardRef } from 'react';
import { RETURN_TRANSITION } from '../motion/tokens';
import { AnimatedGlyph } from './animated-glyph';
import { type AnimatedIconHandle, type AnimatedIconProps, at } from './icon';

const LENS = { cx: 112, cy: 112, r: 80 };
const HANDLE = 'M168.57,168.57L224,224';
const PIVOT = at(123.5, 123.5);
const HUNT = [
  [0, 0, 0],
  [6.71, -5.4, 4.69],
  [6.98, -13.34, 6.96],
  [0.5, -19.12, 4.93],
  [-8.93, -19.34, -0.21],
  [-15.78, -13.89, -5.45],
  [-16.05, -5.94, -7.72],
  [-9.57, -0.17, -5.69],
  [0, 0, 0],
] as const;

const hunt: Variants = {
  normal: { x: 0, y: 0, rotate: 0, transition: RETURN_TRANSITION },
  animate: {
    x: HUNT.map((k) => k[0]),
    y: HUNT.map((k) => k[1]),
    rotate: HUNT.map((k) => k[2]),
    transition: { duration: 0.65, ease: 'easeInOut', times: HUNT.map((_, i) => i / 8) },
  },
};

export const MagnifyingGlassIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  function MagnifyingGlassIcon(props, ref) {
    return (
      <AnimatedGlyph ref={ref} overflow="visible" {...props}>
        <motion.g variants={hunt} style={PIVOT}>
          <circle cx={LENS.cx} cy={LENS.cy} r={LENS.r} />
          <path d={HANDLE} />
        </motion.g>
      </AnimatedGlyph>
    );
  },
);
