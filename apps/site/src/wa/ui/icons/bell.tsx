'use client';

import { motion, type Variants } from 'motion/react';
import { forwardRef } from 'react';
import { RETURN_TRANSITION } from '../motion/tokens';
import { AnimatedGlyph } from './animated-glyph';
import type { AnimatedIconHandle, AnimatedIconProps } from './icon';

const SHELL =
  'M221.8,175.94C216.25,166.38,208,139.33,208,104a80,80,0,1,0-160,0c0,35.34-8.26,62.38-13.81,71.94A16,16,0,0,0,48,200H208a16,16,0,0,0,13.8-24.06ZM48,184c7.7-13.24,16-43.92,16-80a64,64,0,1,1,128,0c0,36.05,8.28,66.73,16,80Z';
const CLAPPER = 'M88.81,200a40,40,0,0,0,78.38,0L150.62,200A24,24,0,0,1,105.38,200Z';
const CROWN = { transformBox: 'view-box', originX: 0.5, originY: 24 / 256 } as const;

const shell: Variants = {
  normal: { rotate: 0, transition: RETURN_TRANSITION },
  animate: {
    rotate: [0, -11, 12, -9.5, 7.4, -2.5, 0],
    transition: { duration: 0.65, times: [0, 0.2, 0.44, 0.64, 0.8, 0.92, 1], ease: 'easeInOut' },
  },
};
const clapper: Variants = {
  normal: { x: 0, transition: RETURN_TRANSITION },
  animate: {
    x: [0, -16, 16, -13, 9, -3.5, 0],
    transition: { duration: 0.65, times: [0, 0.24, 0.48, 0.68, 0.84, 0.94, 1], ease: 'easeInOut' },
  },
};

export const BellIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  function BellIcon(props, ref) {
    return (
      <AnimatedGlyph ref={ref} filled overflow="visible" {...props}>
        <motion.g variants={shell} style={CROWN}>
          <path d={SHELL} />
          <motion.path d={CLAPPER} variants={clapper} />
        </motion.g>
      </AnimatedGlyph>
    );
  },
);
