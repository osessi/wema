'use client';

import { motion } from 'motion/react';
import { type CSSProperties, forwardRef, type ReactNode, useImperativeHandle } from 'react';
import { type AnimatedIconHandle, type AnimatedIconProps, PHOSPHOR_STROKE } from './icon';
import { useIconMotion } from './use-icon-motion';

export interface AnimatedGlyphProps extends AnimatedIconProps {
  readonly children: ReactNode;
  readonly overflow?: 'hidden' | 'visible' | undefined;
  readonly filled?: boolean | undefined;
}

export const AnimatedGlyph = forwardRef<AnimatedIconHandle, AnimatedGlyphProps>(
  function AnimatedGlyph(
    { size = 20, style, children, overflow = 'hidden', filled = false, ...props },
    ref,
  ) {
    const { controls, start, stop, bind } = useIconMotion();
    useImperativeHandle(ref, () => ({ start, stop }), [start, stop]);
    const box: CSSProperties = { display: 'inline-flex', overflow, ...style };
    const paint = filled ? { fill: 'currentColor' } : PHOSPHOR_STROKE;
    return (
      <span {...props} {...bind} style={box}>
        <motion.svg
          xmlns="http://www.w3.org/2000/svg"
          width={size}
          height={size}
          viewBox="0 0 256 256"
          aria-hidden="true"
          initial="normal"
          animate={controls}
          style={{ overflow: 'visible' }}
          {...paint}
        >
          {children}
        </motion.svg>
      </span>
    );
  },
);
