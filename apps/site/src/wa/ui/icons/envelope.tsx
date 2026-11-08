'use client';

import { motion, type Variants } from 'motion/react';
import { forwardRef } from 'react';
import { ARRIVE, RETURN_TRANSITION } from '../motion/tokens';
import { AnimatedGlyph } from './animated-glyph';
import type { AnimatedIconHandle, AnimatedIconProps } from './icon';

const FLAP_REST = 'M224,56L128,144L32,56';
const FLAP_OPEN = 'M224,56L128,12L32,56';
const BODY = 'M32,56H224a0,0,0,0,1,0,0V192a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V56A0,0,0,0,1,32,56Z';
const CREASE_L = 'M110.55,128L34.47,197.74';
const CREASE_R = 'M221.53,197.74L145.45,128';

const flap: Variants = {
  normal: { d: FLAP_REST, transition: RETURN_TRANSITION },
  animate: {
    d: [FLAP_REST, FLAP_OPEN, FLAP_OPEN, FLAP_REST],
    transition: { duration: 0.55, ease: ARRIVE, times: [0, 0.25, 0.6, 1] },
  },
};

export const EnvelopeIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  function EnvelopeIcon(props, ref) {
    return (
      <AnimatedGlyph ref={ref} overflow="visible" {...props}>
        <motion.path d={FLAP_REST} variants={flap} />
        <path d={BODY} />
        <path d={CREASE_L} />
        <path d={CREASE_R} />
      </AnimatedGlyph>
    );
  },
);
