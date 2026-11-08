import type { CSSProperties, HTMLAttributes, ReactNode, Ref } from 'react';
import { cn } from '../../lib/utils';

export type GlowTone = 'ember' | 'crimson' | 'orchid' | 'indigo' | 'emerald' | 'gold';
export type GlowIdle = 'none' | 'breathe' | 'orbit' | 'shimmer';

export const GLOW_TONES: Readonly<
  Record<GlowTone, { readonly a: string; readonly b: string; readonly core: string }>
> = {
  ember: { a: 'var(--glow-ember-a)', b: 'var(--glow-ember-b)', core: 'var(--glow-ember-core)' },
  crimson: {
    a: 'var(--glow-crimson-a)',
    b: 'var(--glow-crimson-b)',
    core: 'var(--glow-crimson-core)',
  },
  orchid: {
    a: 'var(--glow-orchid-a)',
    b: 'var(--glow-orchid-b)',
    core: 'var(--glow-orchid-core)',
  },
  indigo: {
    a: 'var(--glow-indigo-a)',
    b: 'var(--glow-indigo-b)',
    core: 'var(--glow-indigo-core)',
  },
  emerald: {
    a: 'var(--glow-emerald-a)',
    b: 'var(--glow-emerald-b)',
    core: 'var(--glow-emerald-core)',
  },
  gold: { a: 'var(--glow-gold-a)', b: 'var(--glow-gold-b)', core: 'var(--glow-gold-core)' },
};

export interface GlowTileProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  readonly tone: GlowTone;
  readonly size: number;
  readonly idle?: GlowIdle | undefined;
  readonly lit?: boolean | undefined;
  readonly ref?: Ref<HTMLSpanElement> | undefined;
  readonly children: ReactNode;
}

export function GlowTile({
  tone,
  size,
  idle = 'none',
  lit = false,
  className,
  style,
  ref,
  children,
  ...props
}: GlowTileProps) {
  const t = GLOW_TONES[tone];
  return (
    <span
      ref={ref}
      aria-hidden="true"
      data-slot="glow-tile"
      data-lit={lit ? '' : undefined}
      {...props}
      className={cn('gi', idle !== 'none' && `gi-${idle}`, className)}
      style={
        {
          '--gi-a': t.a,
          '--gi-b': t.b,
          '--gi-core': t.core,
          '--gi-size': `${size}px`,
          ...style,
        } as CSSProperties
      }
    >
      <span className="gi-glow" />
      <span className="gi-rim" />
      <span className="gi-glyph">{children}</span>
    </span>
  );
}
