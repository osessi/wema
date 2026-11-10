'use client';

import {
  Books,
  CalendarBlank,
  CalendarCheck,
  ChatsCircle,
  ChatText,
  ClockCounterClockwise,
  CursorClick,
  EnvelopeSimple,
  Handshake,
  Phone,
  Plugs,
  Strategy,
  Target,
} from '@phosphor-icons/react';
import { motion, type Variants } from 'motion/react';
import { type ComponentType, forwardRef, useImperativeHandle } from 'react';
import { ARRIVE, RETURN_TRANSITION } from '../motion/tokens';
import type { AnimatedIconHandle, AnimatedIconProps } from './icon';
import { useIconMotion } from './use-icon-motion';

interface Gesture {
  readonly keyframes: Readonly<Record<string, readonly number[]>>;
  readonly duration: number;
  readonly origin?: readonly [number, number] | undefined;
}

function variantsOf(gesture: Gesture): Variants {
  const rest = Object.fromEntries(Object.keys(gesture.keyframes).map((key) => [key, 0]));
  return {
    normal: { ...rest, transition: RETURN_TRANSITION },
    animate: {
      ...(gesture.keyframes as Record<string, number[]>),
      transition: { duration: gesture.duration, ease: ARRIVE },
    },
  };
}

export function gestureIcon(
  Glyph: ComponentType<{ readonly size?: number }>,
  gesture: Gesture,
  displayName: string,
) {
  const variants = variantsOf(gesture);
  const [ox, oy] = gesture.origin ?? [0.5, 0.5];
  const Component = forwardRef<AnimatedIconHandle, AnimatedIconProps>(function GestureIcon(
    { size = 20, style, ...props },
    ref,
  ) {
    const { controls, start, stop, bind } = useIconMotion();
    useImperativeHandle(ref, () => ({ start, stop }), [start, stop]);
    return (
      <span {...props} {...bind} style={{ display: 'inline-flex', ...style }}>
        <motion.span
          aria-hidden="true"
          initial="normal"
          animate={controls}
          variants={variants}
          style={{ display: 'inline-flex', originX: ox, originY: oy }}
        >
          <Glyph size={size} />
        </motion.span>
      </span>
    );
  });
  Component.displayName = displayName;
  return Component;
}

export const StrategyIcon = gestureIcon(
  Strategy,
  { keyframes: { rotate: [0, -12, 6, 0], y: [0, -1.5, 0, 0] }, duration: 0.55 },
  'StrategyIcon',
);

export const ChatsCircleIcon = gestureIcon(
  ChatsCircle,
  { keyframes: { y: [0, -2.5, 0], rotate: [0, -8, 0] }, duration: 0.5, origin: [0.3, 0.9] },
  'ChatsCircleIcon',
);

export const CalendarBlankIcon = gestureIcon(
  CalendarBlank,
  { keyframes: { rotate: [0, -10, 4, 0], y: [0, -2, 0, 0] }, duration: 0.5, origin: [0.5, 0.1] },
  'CalendarBlankIcon',
);

export const BooksIcon = gestureIcon(
  Books,
  { keyframes: { rotate: [0, -9, 0], x: [0, -1, 0] }, duration: 0.5, origin: [0.2, 1] },
  'BooksIcon',
);

export const PlugsIcon = gestureIcon(
  Plugs,
  { keyframes: { x: [0, 2.5, -1, 0], y: [0, -2.5, 1, 0] }, duration: 0.45 },
  'PlugsIcon',
);

export const LOGO_GESTURES = {
  linkedin: { keyframes: { y: [0, -2.5, 0.5, 0], rotate: [0, -6, 0, 0] }, duration: 0.45 },
  whatsapp: { keyframes: { rotate: [0, -10, 8, -4, 0] }, duration: 0.5 },
  messenger: {
    keyframes: { y: [0, -3, 1, 0], rotate: [0, 6, -3, 0] },
    duration: 0.5,
    origin: [0.3, 0.9],
  },
  instagram: { keyframes: { rotate: [0, -9, 5, 0], y: [0, -1.5, 0, 0] }, duration: 0.45 },
} as const satisfies Readonly<Record<string, Gesture>>;

export const ChatTextIcon = gestureIcon(
  ChatText,
  { keyframes: { x: [0, 2, 0], y: [0, -2.5, 0] }, duration: 0.45 },
  'ChatTextIcon',
);

export const PhoneIcon = gestureIcon(
  Phone,
  { keyframes: { rotate: [0, -14, 12, -8, 6, 0] }, duration: 0.6, origin: [0.5, 0.6] },
  'PhoneIcon',
);

export const TargetIcon = gestureIcon(
  Target,
  { keyframes: { x: [0, 2, -1, 0], y: [0, -2, 1, 0], rotate: [0, 8, -3, 0] }, duration: 0.45 },
  'TargetIcon',
);

export const HandshakeIcon = gestureIcon(
  Handshake,
  { keyframes: { y: [0, -2, 1.5, -1, 0], rotate: [0, -4, 3, -2, 0] }, duration: 0.55 },
  'HandshakeIcon',
);

export const EnvelopeSimpleIcon = gestureIcon(
  EnvelopeSimple,
  { keyframes: { x: [0, 3, 0], y: [0, -3, 0], rotate: [0, -8, 0] }, duration: 0.5 },
  'EnvelopeSimpleIcon',
);

export const ClockCounterClockwiseIcon = gestureIcon(
  ClockCounterClockwise,
  { keyframes: { rotate: [0, -40, 8, 0] }, duration: 0.6 },
  'ClockCounterClockwiseIcon',
);

export const CalendarCheckIcon = gestureIcon(
  CalendarCheck,
  { keyframes: { y: [0, -3, 0.5, 0], rotate: [0, -6, 2, 0] }, duration: 0.5, origin: [0.5, 0.9] },
  'CalendarCheckIcon',
);

export const CursorClickIcon = gestureIcon(
  CursorClick,
  { keyframes: { x: [0, 1.5, 0], y: [0, 1.5, 0], rotate: [0, -6, 0] }, duration: 0.4 },
  'CursorClickIcon',
);
