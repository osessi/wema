'use client';

import { motion, type Variants } from 'motion/react';
import { forwardRef } from 'react';
import { ARRIVE, RETURN_TRANSITION } from '../motion/tokens';
import { AnimatedGlyph } from './animated-glyph';
import type { AnimatedIconHandle, AnimatedIconProps } from './icon';

const DUR = 0.55;
const TIMES = [0, 0.3, 0.6, 1];

const divider = (to: number): Variants => ({
  normal: { x: 0, transition: RETURN_TRANSITION },
  animate: { x: [0, to, to, 0], transition: { duration: DUR, ease: ARRIVE, times: TIMES } },
});
const panel: Variants = {
  normal: { opacity: 1, transition: RETURN_TRANSITION },
  animate: {
    opacity: [1, 0.25, 0.25, 1],
    transition: { duration: DUR, ease: 'easeInOut', times: TIMES },
  },
};

export interface SidebarSimpleIconProps extends AnimatedIconProps {
  readonly intent?: 'collapse' | 'expand' | undefined;
}

export const SidebarSimpleIcon = forwardRef<AnimatedIconHandle, SidebarSimpleIconProps>(
  function SidebarSimpleIcon({ intent = 'collapse', ...props }, ref) {
    const travel = intent === 'collapse' ? -40 : 48;
    return (
      <AnimatedGlyph ref={ref} {...props}>
        <rect x="40" y="56" width="176" height="144" rx="8" />
        <motion.path d="M88,56v144" variants={divider(travel)} />
        <motion.path
          d="M52,84h20M52,108h20"
          variants={panel}
          style={{ transformBox: 'view-box', originX: 40 / 256, originY: 0.5 }}
        />
      </AnimatedGlyph>
    );
  },
);
