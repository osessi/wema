'use client';

import { cn } from '../../../ui/lib/utils';
import { type CSSProperties, useRef } from 'react';
import { Avatar, Figure, type StepTone, TONE_HEX, TonePill, useFigureClock } from './figure';
import s from './journey.module.css';

const MESSAGE =
  'Décembre approche, et votre PER aussi. Trois erreurs à éviter avant le 31 décembre, expliquées en 30 secondes par le Cabinet Dubois Patrimoine, à Lyon.';

const SCENES: readonly {
  readonly name: string;
  readonly message: string;
  readonly time: string;
  readonly landed: string;
}[] = [
  { name: 'Accroche', message: 'Votre PER', time: '0-3 s', landed: 'Prête' },
  { name: 'Le problème', message: 'Ce qu’on oublie', time: '3-10 s', landed: 'Prête' },
  { name: 'Votre entreprise', message: 'Site et logo', time: '10-22 s', landed: 'Prête' },
  { name: 'Appel à l’action', message: 'Prendre RDV', time: '22-28 s', landed: 'Prête' },
  { name: 'Signature', message: 'By Winner Agency', time: '28-30 s', landed: 'Prête' },
];

const tone: StepTone = 'ember';
const CHARS_PER_TICK = 3;
const HOLD = 30;

export function FigureEngage({ index }: { readonly index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const cycle = Math.ceil(MESSAGE.length / CHARS_PER_TICK) + HOLD;
  const { step, active, reduced } = useFigureClock(ref, 60, cycle - 1);
  const typed = Math.min(MESSAGE.length, (step % cycle) * CHARS_PER_TICK);
  const done = typed >= MESSAGE.length;

  return (
    <Figure
      figureRef={ref}
      active={active}
      index={index}
      caption="Votre vidéo · 30 secondes"
      status="En production"
      tone={tone}
    >
      <div className="flex h-full flex-col gap-3 p-3.5 sm:p-4">
        <div
          className="rounded-[12px] border bg-surface"
          style={{ borderColor: TONE_HEX[tone], boxShadow: `0 0 0 3px ${TONE_HEX[tone]}26` }}
        >
          <div
            className="flex items-center gap-2 border-b px-3 py-2"
            style={{ borderColor: `${TONE_HEX[tone]}66` }}
          >
            <Avatar name="Claire Dubois" className="size-6 text-[9.5px]" />
            <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-foreground">
              Script{' '}
              <span className="font-normal text-foreground/60">
                · Cabinet Dubois Patrimoine, Lyon
              </span>
            </span>
            <TonePill tone={tone}>Voix off</TonePill>
          </div>
          <p className="min-h-[66px] px-3 py-2.5 text-[12.5px] leading-relaxed text-foreground/85 sm:min-h-[58px]">
            {MESSAGE.slice(0, typed)}
            {done ? null : (
              <span
                className={cn(
                  s.caret,
                  'ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[2px] bg-[var(--tone)]',
                )}
              />
            )}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 border-t border-[var(--tk-line)] px-3 py-2">
            <span className="font-mono text-[10px] tracking-[0.08em] text-muted-foreground uppercase">
              Sujet
            </span>
            <TonePill tone={tone}>3 erreurs avant le 31/12</TonePill>
            <TonePill tone="neutral" className="hidden sm:inline-flex">
              Sans promesse de rendement
            </TonePill>
          </div>
        </div>

        <ol className="flex flex-1 flex-col justify-center gap-2">
          {SCENES.map((channel, i) => {
            const delay = { '--d': `${i * 0.9}s` } as CSSProperties;
            return (
              <li
                key={channel.name}
                className="grid grid-cols-[100px_minmax(0,1fr)_72px] items-center gap-2.5 rounded-[10px] border border-[var(--tk-line)] bg-surface px-2.5 py-2 sm:grid-cols-[118px_minmax(0,1fr)_84px] sm:py-2.5"
              >
                <span className="flex items-center gap-2">
                  <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-[8px] border border-[var(--tk-edge)] bg-surface font-mono text-[11px] font-semibold text-foreground/75 tabular-nums">
                    {i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] font-semibold text-foreground">
                      {channel.name}
                    </span>
                    <span className="block font-mono text-[10px] text-muted-foreground">
                      {channel.time}
                    </span>
                  </span>
                </span>
                <span className={cn(s.track, 'relative flex h-7 items-center')}>
                  <span className="absolute inset-x-0 top-1/2 border-t border-dashed border-[var(--tk-rule)] opacity-60" />
                  {reduced ? null : (
                    <span
                      className={cn(s.trail, 'absolute inset-x-0 top-1/2 h-px bg-[var(--tone)]')}
                      style={delay}
                    />
                  )}
                  <span
                    className={cn(
                      'relative inline-flex items-center gap-1 rounded-full bg-[var(--tone)] px-2 py-[3px] text-[10.5px] font-semibold whitespace-nowrap text-[#15160F] shadow-[0_8px_18px_-12px_rgb(13_14_11/0.7)]',
                      !reduced && s.travel,
                    )}
                    style={delay}
                  >
                    <span className="size-1.5 rounded-full bg-[#15160F]" />
                    {channel.message}
                  </span>
                </span>
                <span
                  className={cn(
                    'justify-self-end font-mono text-[10.5px] font-semibold tracking-[0.04em] text-foreground uppercase',
                    !reduced && s.delivered,
                  )}
                  style={delay}
                >
                  ✓ {channel.landed}
                </span>
              </li>
            );
          })}
        </ol>
        <p className="flex items-center justify-between gap-3 border-t border-[var(--tk-line)] pt-2.5 font-mono text-[10px] tracking-[0.08em] text-muted-foreground uppercase">
          <span>Vertical 1080 × 1920</span>
          <span className="hidden sm:inline">Offerte, sans engagement</span>
        </p>
      </div>
    </Figure>
  );
}
