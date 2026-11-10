'use client';

import { motion, type Variants } from 'motion/react';
import { forwardRef } from 'react';
import { ARRIVE, RETURN_TRANSITION, staged } from '../motion/tokens';
import { AnimatedGlyph } from './animated-glyph';
import type { AnimatedIconHandle, AnimatedIconProps } from './icon';

const RIM = { cx: 128, cy: 80, rx: 88, ry: 48 };
const WALLS = 'M40,80V176M216,80V176';
const LAYER_MID = 'M40,128a88,48,0,0,0,176,0';
const LAYER_LOW = 'M40,176a88,48,0,0,0,176,0';

const drop = (i: number, dy: number): Variants => ({
  normal: { y: 0, transition: RETURN_TRANSITION },
  animate: {
    y: [0, dy, 0],
    transition: { duration: 0.5, ease: ['easeIn', ARRIVE], times: [0, 0.45, 1], delay: staged(i) },
  },
});
const mid = drop(0, 18);
const low = drop(1, 18);

export const DatabaseIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  function DatabaseIcon(props, ref) {
    return (
      <AnimatedGlyph ref={ref} overflow="visible" {...props}>
        <ellipse cx={RIM.cx} cy={RIM.cy} rx={RIM.rx} ry={RIM.ry} />
        <path d={WALLS} />
        <motion.path d={LAYER_MID} variants={mid} />
        <motion.path d={LAYER_LOW} variants={low} />
      </AnimatedGlyph>
    );
  },
);
