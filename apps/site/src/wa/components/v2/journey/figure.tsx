'use client';

import { cn } from '../../../ui/lib/utils';
import { type CSSProperties, type ReactNode, type RefObject, useEffect, useState } from 'react';
import { personPhoto } from '../../../content/people';
import { useInView, useReducedMotion } from '../tsf/tsf-motion';
import s from './journey.module.css';

export type StepTone = 'ember' | 'crimson' | 'orchid' | 'indigo' | 'emerald' | 'gold';

export const TONE_HEX: Readonly<Record<StepTone, string>> = {
  ember: '#ffc94d',
  crimson: '#FF4D5E',
  orchid: '#E46BFF',
  indigo: '#5B7CFF',
  emerald: '#ffc529',
  gold: '#FFC24D',
};

export function useFigureClock(
  ref: RefObject<Element | null>,
  period: number,
  still: number,
): { readonly step: number; readonly active: boolean; readonly reduced: boolean } {
  const reduced = useReducedMotion();
  const { visible } = useInView(ref, 0.25);
  const active = visible && !reduced;
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => {
      if (!document.hidden) setStep((n) => n + 1);
    }, period);
    return () => window.clearInterval(id);
  }, [active, period]);
  return { step: reduced ? still : step, active, reduced };
}

export function Figure({
  figureRef,
  active,
  index,
  caption,
  status,
  tone,
  children,
  className,
  decorative = true,
}: {
  readonly figureRef: RefObject<HTMLDivElement | null>;
  readonly active: boolean;
  readonly index: number;
  readonly caption: string;
  readonly status: string;
  readonly tone: StepTone;
  readonly children: ReactNode;
  readonly className?: string | undefined;
  readonly decorative?: boolean;
}) {
  return (
    <div
      ref={figureRef}
      data-active={active ? '' : undefined}
      aria-hidden={decorative ? 'true' : undefined}
      className={cn(s.fig, 'flex h-full min-h-0 flex-col', className)}
      style={{ '--tone': TONE_HEX[tone] } as CSSProperties}
    >
      {(['tl', 'tr', 'bl', 'br'] as const).map((at) => (
        <span key={at} className={s.tick} data-at={at} />
      ))}
      <div className="flex items-center justify-between gap-3 border-b border-[var(--tk-line)] bg-surface/80 px-3.5 py-2 font-mono text-[10.5px] tracking-[0.08em] text-muted-foreground uppercase">
        <span className="truncate">
          Fig. {String(index + 1).padStart(2, '0')} · {caption}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="relative inline-flex size-1.5">
            <span className={cn(s.ping, 'absolute inset-0 rounded-full bg-[var(--tone)]')} />
            <span className="relative size-1.5 rounded-full bg-[var(--tone)]" />
          </span>
          {status}
        </span>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

function Initials({
  name,
  className,
}: {
  readonly name: string;
  readonly className?: string | undefined;
}) {
  const initials = name
    .split(' ')
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2);
  return (
    <span
      className={cn(
        'inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-[var(--tk-line)] bg-foreground/[0.05] text-[10.5px] font-semibold text-foreground/80',
        className,
      )}
    >
      {initials}
    </span>
  );
}

export function Avatar({
  name,
  className,
}: {
  readonly name: string;
  readonly className?: string | undefined;
}) {
  const src = personPhoto(name);
  const [failed, setFailed] = useState(false);
  if (src === null || failed) return <Initials name={name} className={className} />;
  return (
    // biome-ignore lint/performance/noImgElement: tiny decorative portraits inside an animated figure.
    <img
      src={src}
      alt=""
      decoding="async"
      draggable={false}
      onError={() => setFailed(true)}
      className={cn(
        'size-7 shrink-0 rounded-full border border-[var(--tk-line)] bg-foreground/[0.05] object-cover',
        className,
      )}
    />
  );
}

export function ToneWord({
  tone,
  children,
}: {
  readonly tone: StepTone | 'brand';
  readonly children: ReactNode;
}) {
  return (
    <span
      className="text-[color-mix(in_srgb,var(--tone)_80%,#171714)] dark:text-[var(--tone)]"
      style={{ '--tone': tone === 'brand' ? '#ffc529' : TONE_HEX[tone] } as CSSProperties}
    >
      {children}
    </span>
  );
}

export function BrandMark({
  name,
  className,
}: {
  readonly name:
    | 'gmail'
    | 'linkedin'
    | 'whatsapp'
    | 'google-calendar'
    | 'microsoft'
    | 'facebook'
    | 'instagram'
    | 'google'
    | 'youtube';
  readonly className?: string | undefined;
}) {
  return (
    // biome-ignore lint/performance/noImgElement: tiny static SVG marks, no optimisation needed.
    <img src={`/brands/${name}.svg`} alt="" className={cn('size-4', className)} />
  );
}

export function TonePill({
  tone,
  children,
  className,
}: {
  readonly tone: StepTone | 'neutral';
  readonly children: ReactNode;
  readonly className?: string | undefined;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-[3px] font-mono text-[10.5px] leading-none font-semibold tracking-[0.02em]',
        tone === 'neutral' ? 'bg-foreground/[0.08] text-foreground/70' : 'text-[#15160F]',
        className,
      )}
      style={tone === 'neutral' ? undefined : { backgroundColor: TONE_HEX[tone] }}
    >
      {children}
    </span>
  );
}
