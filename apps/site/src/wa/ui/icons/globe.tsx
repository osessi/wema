'use client';

import { motion, type Variants } from 'motion/react';
import { forwardRef } from 'react';
import { RETURN_TRANSITION } from '../motion/tokens';
import { AnimatedGlyph } from './animated-glyph';
import type { AnimatedIconHandle, AnimatedIconProps } from './icon';

const R = 96;
const lens = (w: number): string =>
  `M${128 + w},128c0,64,${-w},96,${-w},96s${-w},-32,${-w},-96,${w},-96,${w},-96S${128 + w},64,${128 + w},128Z`;
const LENS_REST = lens(40);
const LENS_EDGE = lens(0);

const turn: Variants = {
  normal: { d: LENS_REST, transition: RETURN_TRANSITION },
  animate: {
    d: [LENS_REST, LENS_EDGE, LENS_REST],
    transition: { duration: 0.6, ease: 'easeInOut', times: [0, 0.5, 1] },
  },
};

export const GlobeIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  function GlobeIcon(props, ref) {
    return (
      <AnimatedGlyph ref={ref} {...props}>
        <motion.path d={LENS_REST} variants={turn} />
        <circle cx="128" cy="128" r={R} />
        <line x1="37.46" y1="96" x2="218.54" y2="96" />
        <line x1="37.46" y1="160" x2="218.54" y2="160" />
      </AnimatedGlyph>
    );
  },
);
