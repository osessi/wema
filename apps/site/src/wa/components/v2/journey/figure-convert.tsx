'use client';

import { cn } from '../../../ui/lib/utils';
import { motion } from 'motion/react';
import { useRef } from 'react';
import {
  Avatar,
  BrandMark,
  Figure,
  type StepTone,
  TONE_HEX,
  TonePill,
  useFigureClock,
} from './figure';
import s from './journey.module.css';

const REPLIES: readonly {
  readonly name: string;
  readonly reply: string;
  readonly mark: 'facebook' | 'instagram' | 'google';
  readonly score: number;
  readonly next: string;
}[] = [
  {
    name: 'Julien Marchand',
    reply: 'Super clair, merci pour la vidéo !',
    mark: 'instagram',
    score: 18,
    next: 'Remercié',
  },
  {
    name: 'Sophie Laurent',
    reply: 'Je peux avoir un rendez-vous jeudi ?',
    mark: 'facebook',
    score: 96,
    next: 'Transmis au dirigeant',
  },
  {
    name: 'Marc Dupuis',
    reply: 'C’est valable pour un PER déjà ouvert ?',
    mark: 'instagram',
    score: 64,
    next: 'Répondu',
  },
  {
    name: 'Nadia Benali',
    reply: 'Très bon accueil, je recommande.',
    mark: 'google',
    score: 30,
    next: 'Avis remercié',
  },
  {
    name: 'Pierre Morel',
    reply: 'Quels sont vos honoraires ?',
    mark: 'facebook',
    score: 82,
    next: 'Transmis au dirigeant',
  },
  {
    name: 'Emma Girard',
    reply: 'Vous intervenez aussi à Villeurbanne ?',
    mark: 'google',
    score: 52,
    next: 'Répondu',
  },
];

const tone: StepTone = 'orchid';
const SORT_AT = REPLIES.length + 2;
const CYCLE = SORT_AT + 9;

function intent(score: number): { readonly label: string; readonly tone: StepTone | 'neutral' } {
  if (score >= 75) return { label: 'Pour vous', tone: 'emerald' };
  if (score >= 40) return { label: 'Répondu', tone: 'gold' };
  return { label: 'Remercié', tone: 'neutral' };
}

export function FigureConvert({ index }: { readonly index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const { step: tick, active, reduced } = useFigureClock(ref, 750, CYCLE - 1);
  const step = tick % CYCLE;
  const sorted = step >= SORT_AT;
  const rows = REPLIES.map((reply, order) => ({ ...reply, order }));
  if (sorted) rows.sort((a, b) => b.score - a.score);
  const scoredCount = Math.min(REPLIES.length, step);
  const hot = REPLIES.slice(0, scoredCount).filter((r) => r.score >= 75).length;

  return (
    <Figure
      figureRef={ref}
      active={active}
      index={index}
      caption="Commentaires et messages · répondus"
      status={sorted ? 'Triés' : 'Lecture en cours'}
      tone={tone}
    >
      <div className="flex h-full flex-col p-3.5 sm:p-4">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <span className="text-[12.5px] font-semibold text-foreground">
            Messages · tous les réseaux
          </span>
          <span className="flex items-center gap-2 font-mono text-[10.5px] tracking-[0.04em] text-muted-foreground">
            <span>
              <span className="text-foreground tabular-nums">{scoredCount}</span>/{REPLIES.length}{' '}
              traités
            </span>
            <TonePill tone={tone}>
              <span className="tabular-nums">{hot}</span> pour vous
            </TonePill>
          </span>
        </div>
        <ul className="flex flex-1 flex-col gap-1.5">
          {rows.map((row) => {
            const scored = row.order < scoredCount;
            const scoring = !reduced && row.order === scoredCount && step < REPLIES.length;
            const level = intent(row.score);
            return (
              <motion.li
                key={row.name}
                layout={!reduced}
                transition={{ type: 'spring', stiffness: 260, damping: 30 }}
                className={cn(
                  'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[10px] border bg-surface px-2.5 py-2 sm:grid-cols-[minmax(0,1fr)_112px_auto]',
                  scoring || (sorted && row.score >= 75)
                    ? 'border-[var(--tone)] shadow-[0_0_0_3px_color-mix(in_srgb,var(--tone)_16%,transparent)]'
                    : 'border-[var(--tk-line)]',
                )}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="relative">
                    <Avatar name={row.name} />
                    <span className="absolute -right-1 -bottom-1 inline-flex size-[15px] items-center justify-center rounded-full border border-[var(--tk-line)] bg-surface">
                      <BrandMark name={row.mark} className="size-[9px]" />
                    </span>
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[12px] leading-tight font-semibold text-foreground">
                      {row.name}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] leading-tight text-foreground/70">
                      “{row.reply}”
                    </p>
                  </div>
                </div>
                <div className="hidden flex-col gap-1 sm:flex">
                  <span className="block h-1 overflow-hidden rounded-full bg-foreground/[0.08]">
                    <span
                      className={cn(
                        'block h-full rounded-full transition-[width] duration-700 ease-out',
                        scoring && s.shimmer,
                      )}
                      style={{
                        width: scored ? `${row.score}%` : scoring ? '100%' : '0%',
                        backgroundColor: scored
                          ? level.tone === 'neutral'
                            ? 'var(--muted-foreground)'
                            : TONE_HEX[level.tone]
                          : undefined,
                      }}
                    />
                  </span>
                  <span className="truncate font-mono text-[9.5px] tracking-[0.04em] text-muted-foreground uppercase">
                    {scored ? `→ ${row.next}` : scoring ? 'Lecture…' : 'En attente'}
                  </span>
                </div>
                <span className="flex items-center justify-end gap-1.5 sm:w-[118px]">
                  {scored ? (
                    <>
                      <span
                        className="size-2 rounded-full sm:hidden"
                        style={{
                          backgroundColor:
                            level.tone === 'neutral'
                              ? 'var(--muted-foreground)'
                              : TONE_HEX[level.tone],
                        }}
                      />
                      <TonePill
                        tone={level.tone}
                        className={cn('hidden sm:inline-flex', !reduced && s.pop)}
                      >
                        {level.label}
                      </TonePill>
                      <span className="w-7 text-right font-mono text-[11.5px] font-semibold text-foreground tabular-nums">
                        {row.score}%
                      </span>
                    </>
                  ) : (
                    <span
                      className={cn(
                        'h-[17px] w-10 rounded-full sm:w-[86px]',
                        scoring ? s.shimmer : 'bg-foreground/[0.06]',
                      )}
                    />
                  )}
                </span>
              </motion.li>
            );
          })}
        </ul>
      </div>
    </Figure>
  );
}
