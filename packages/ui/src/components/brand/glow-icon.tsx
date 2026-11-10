"use client";

import { type ComponentType, type Ref, useRef } from "react";
import { type GlowIdle, GlowTile, type GlowTone } from "./glow-tile";
import type { AnimatedIconHandle, AnimatedIconProps } from "./icons/icon";

export type AnimatedIcon = ComponentType<
  AnimatedIconProps & { ref?: Ref<AnimatedIconHandle> }
>;

export interface GlowIconProps {
  readonly tone: GlowTone;
  /** Icône animée de `brand/icons` (ou fabriquée par `gestureIcon`). */
  readonly icon: AnimatedIcon;
  readonly idle?: GlowIdle | undefined;
  /** Côté en pixels, 72 par défaut. Le glyphe en fait la moitié. */
  readonly size?: number | undefined;
  readonly lit?: boolean | undefined;
  readonly className?: string | undefined;
}

/** Pastille lumineuse dont l'icône s'anime quand le pointeur entre. */
export function GlowIcon({
  tone,
  icon: Icon,
  idle = "none",
  size = 72,
  lit,
  className,
}: GlowIconProps) {
  const gesture = useRef<AnimatedIconHandle>(null);
  return (
    <GlowTile
      tone={tone}
      size={size}
      idle={idle}
      lit={lit}
      className={className}
      onPointerEnter={() => gesture.current?.start()}
      onPointerLeave={() => gesture.current?.stop()}
    >
      <Icon
        ref={gesture}
        size={Math.round(size / 2)}
        className="pointer-events-none"
      />
    </GlowTile>
  );
}
