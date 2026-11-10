'use client';

import { type GlowIdle, GlowTile, type GlowTone } from '../../ui/components/ui/glow-tile';
import type { AnimatedIconHandle, AnimatedIconProps } from '../../ui/icons';
import { type ComponentType, type Ref, useRef } from 'react';

export function GlowIcon({
  tone,
  icon: Icon,
  idle = 'none',
  size = 72,
  className,
}: {
  readonly tone: GlowTone;
  readonly icon: ComponentType<AnimatedIconProps & { ref?: Ref<AnimatedIconHandle> }>;
  readonly idle?: GlowIdle;
  readonly size?: number;
  readonly className?: string;
}) {
  const gesture = useRef<AnimatedIconHandle>(null);
  return (
    <GlowTile
      tone={tone}
      size={size}
      idle={idle}
      className={className}
      onPointerEnter={() => gesture.current?.start()}
      onPointerLeave={() => gesture.current?.stop()}
    >
      <Icon ref={gesture} size={Math.round(size / 2)} className="pointer-events-none" />
    </GlowTile>
  );
}
