'use client';

import { motion, type Variants } from 'motion/react';
import { forwardRef } from 'react';
import { ARRIVE, RETURN_TRANSITION } from '../motion/tokens';
import { AnimatedGlyph } from './animated-glyph';
import { type AnimatedIconHandle, type AnimatedIconProps, at } from './icon';

const ROOF = 'M216,120a8,8,0,0,0-2.34-5.66l-80-80a8,8,0,0,0-11.32,0l-80,80A8,8,0,0,0,40,120';
const ROOF_PEAK = 'M216,120a8,8,0,0,0-2.34-5.66l-80-100a8,8,0,0,0-11.32,0l-80,100A8,8,0,0,0,40,120';
const WALLS = 'M104,216h-64V120M152,216h64V120';
const DOOR = 'M104,216V152h48v64';
const HINGE = at(104, 216);
const DUR = 0.55;

const roof: Variants = {
  normal: { d: ROOF, transition: RETURN_TRANSITION },
  animate: {
    d: [ROOF, ROOF_PEAK, ROOF_PEAK, ROOF],
    transition: { duration: DUR, ease: ARRIVE, times: [0, 0.25, 0.55, 1] },
  },
};
const door: Variants = {
  normal: { scaleX: 1, transition: RETURN_TRANSITION },
  animate: {
    scaleX: [1, 0.12, 0.12, 1],
    transition: { duration: DUR, ease: 'easeInOut', times: [0, 0.3, 0.55, 1] },
  },
};

export const HouseIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  function HouseIcon(props, ref) {
    return (
      <AnimatedGlyph ref={ref} {...props}>
        <motion.path d={ROOF} variants={roof} />
        <path d={WALLS} />
        <motion.path d={DOOR} variants={door} style={HINGE} />
      </AnimatedGlyph>
    );
  },
);
