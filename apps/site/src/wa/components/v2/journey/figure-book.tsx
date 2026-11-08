'use client';

import { Check } from '@phosphor-icons/react/dist/ssr';
import { cn } from '../../../ui/lib/utils';
import { useRef } from 'react';
import { BrandMark, Figure, type StepTone, TONE_HEX, useFigureClock } from './figure';
import s from './journey.module.css';

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'] as const;
const HOURS = ['9', '10', '11', '12', '13', '14', '15', '16'] as const;

const MEETINGS: readonly {
  readonly id: string;
  readonly day: number;
  readonly start: number;
  readonly length: number;
  readonly network: 'instagram' | 'facebook' | 'google' | 'youtube' | 'linkedin';
  readonly label: string;
  readonly time: string;
  readonly tone: StepTone;
  readonly held?: boolean;
}[] = [
  {
    id: 'p1',
    day: 0,
    start: 0.5,
    length: 0.75,
    network: 'instagram',
    label: 'Vidéo',
    time: '9:30',
    tone: 'indigo',
    held: true,
  },
  {
    id: 'p2',
    day: 2,
    start: 1,
    length: 1,
    network: 'google',
    label: 'Post Google',
    time: '10:00',
    tone: 'ember',
  },
  {
    id: 'p3',
    day: 1,
    start: 4,
    length: 0.75,
    network: 'facebook',
    label: 'Vidéo',
    time: '13:00',
    tone: 'orchid',
    held: true,
  },
  {
    id: 'p4',
    day: 3,
    start: 2,
    length: 0.75,
    network: 'instagram',
    label: 'Story',
    time: '11:00',
    tone: 'gold',
  },
  {
    id: 'p5',
    day: 0,
    start: 5.5,
    length: 1,
    network: 'facebook',
    label: 'Vidéo',
    time: '14:30',
    tone: 'ember',
    held: true,
  },
  {
    id: 'p6',
    day: 4,
    start: 0.75,
    length: 0.75,
    network: 'google',
    label: 'Post Google',
    time: '9:45',
    tone: 'indigo',
  },
  {
    id: 'p7',
    day: 2,
    start: 5,
    length: 0.75,
    network: 'youtube',
    label: 'Short',
    time: '14:00',
    tone: 'crimson',
  },
  {
    id: 'p8',
    day: 1,
    start: 1.5,
    length: 1,
    network: 'linkedin',
    label: 'Vidéo',
    time: '10:30',
    tone: 'emerald',
    held: true,
  },
  {
    id: 'p9',
    day: 3,
    start: 5.75,
    length: 0.75,
    network: 'facebook',
    label: 'Réponse avis',
    time: '14:45',
    tone: 'orchid',
  },
  {
    id: 'p10',
    day: 4,
    start: 3.5,
    length: 1,
    network: 'instagram',
    label: 'Vidéo',
    time: '12:30',
    tone: 'gold',
  },
];

const tone: StepTone = 'gold';
const HELD_AT = MEETINGS.length + 2;
const CYCLE = HELD_AT + 7;

export function FigureBook({ index }: { readonly index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const { step: tick, active, reduced } = useFigureClock(ref, 700, CYCLE - 1);
  const step = tick % CYCLE;
  const shown = Math.min(MEETINGS.length, step);
  const heldOn = step >= HELD_AT;
  const held = heldOn ? MEETINGS.filter((m) => m.held === true).length : 0;
  const latest = shown > 0 && !heldOn ? MEETINGS[shown - 1] : undefined;

  return (
    <Figure
      figureRef={ref}
      active={active}
      index={index}
      caption="Votre planning · cette semaine"
      status="Planifié"
      tone={tone}
    >
      <div className="flex h-full flex-col p-3.5 sm:p-4">
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <BrandMark name="instagram" className="size-[14px]" />
            <BrandMark name="facebook" className="size-[14px]" />
            <BrandMark name="google" className="size-[14px]" />
            <span className="text-[12.5px] font-semibold text-foreground">Semaine 47</span>
          </span>
          <span className="flex items-center gap-3 font-mono text-[10.5px] tracking-[0.04em] text-muted-foreground uppercase">
            <span>
              Planifiées{' '}
              <span className="text-[13px] font-semibold text-foreground tabular-nums">
                {shown}
              </span>
            </span>
            <span>
              Validées{' '}
              <span className="text-[13px] font-semibold text-foreground tabular-nums">{held}</span>
            </span>
          </span>
        </div>

        <div className="relative flex min-h-[240px] flex-1 flex-col overflow-hidden rounded-[10px] border border-[var(--tk-edge)] bg-surface">
          <div className="grid grid-cols-[26px_repeat(5,minmax(0,1fr))] border-b border-[var(--tk-line)]">
            <span />
            {DAYS.map((day) => (
              <span
                key={day}
                className="py-1.5 text-center font-mono text-[10.5px] tracking-[0.06em] text-muted-foreground uppercase"
              >
                {day}
              </span>
            ))}
          </div>
          <div className="relative grid flex-1 grid-cols-[26px_repeat(5,minmax(0,1fr))]">
            <div className="grid grid-rows-8">
              {HOURS.map((hour) => (
                <span
                  key={hour}
                  className="pt-0.5 pr-1 text-right font-mono text-[9.5px] text-muted-foreground"
                >
                  {hour}
                </span>
              ))}
            </div>
            {DAYS.map((day, dayIndex) => (
              <div key={day} className="relative grid grid-rows-8 border-l border-[var(--tk-line)]">
                {HOURS.map((hour) => (
                  <span key={hour} className="border-b border-[var(--tk-line)] last:border-b-0" />
                ))}
                {MEETINGS.slice(0, shown).map((m, order) =>
                  m.day === dayIndex ? (
                    <div
                      key={m.id}
                      className={cn(
                        'absolute inset-x-[3px] overflow-hidden rounded-[6px] border px-1.5 py-1',
                        !reduced && s.pop,
                        !reduced && order === shown - 1 && !heldOn && s.land,
                      )}
                      style={{
                        top: `calc(${(m.start / HOURS.length) * 100}% + 1px)`,
                        height: `calc(${(m.length / HOURS.length) * 100}% - 2px)`,
                        borderColor: `color-mix(in srgb, ${TONE_HEX[m.tone]} 55%, transparent)`,
                        backgroundColor: `color-mix(in srgb, ${TONE_HEX[m.tone]} 15%, var(--surface))`,
                        ['--tone' as string]: TONE_HEX[m.tone],
                      }}
                    >
                      <span className="flex items-center gap-1">
                        <BrandMark name={m.network} className="size-3.5" />
                        <span className="truncate font-mono text-[9px] text-foreground/70">
                          {m.time}
                        </span>
                        {heldOn && m.held === true ? (
                          <span
                            className={cn(
                              'ml-auto inline-flex size-3 shrink-0 items-center justify-center rounded-full bg-[#ffc529] text-[#1a1403]',
                              !reduced && s.pop,
                            )}
                          >
                            <Check size={8} weight="bold" />
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block truncate text-[10px] leading-tight font-semibold text-foreground">
                        {m.label}
                      </span>
                    </div>
                  ) : null,
                )}
              </div>
            ))}
          </div>

          {latest === undefined ? null : (
            <div
              key={latest.id}
              className={cn(
                'absolute right-2.5 bottom-2.5 z-10 hidden w-[224px] items-center gap-2.5 rounded-[10px] p-2.5 text-[#15160F] shadow-[0_18px_40px_-20px_rgb(13_14_11/0.55)] sm:flex',
                !reduced && s.pop,
              )}
              style={{ backgroundColor: TONE_HEX[tone] }}
            >
              <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-white/70">
                <BrandMark name={latest.network} className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block font-mono text-[9.5px] font-semibold tracking-[0.08em] uppercase opacity-75">
                  Publication planifiée
                </span>
                <span className="mt-0.5 block truncate text-[12px] font-semibold">
                  {latest.label} · {DAYS[latest.day]} {latest.time}
                </span>
                <span className="mt-0.5 block truncate text-[11px] font-medium opacity-80">
                  Soumise à votre validation
                </span>
              </span>
            </div>
          )}
          {heldOn ? (
            <div
              className={cn(
                'absolute right-2.5 bottom-2.5 z-10 hidden items-center gap-2 rounded-[10px] border border-[var(--tk-edge)] bg-surface px-2.5 py-2 shadow-[0_18px_40px_-20px_rgb(13_14_11/0.55)] sm:flex',
                !reduced && s.pop,
              )}
            >
              <span className="inline-flex size-4 items-center justify-center rounded-full bg-[#ffc529] text-[#1a1403]">
                <Check size={10} weight="bold" />
              </span>
              <span className="text-[11.5px] font-semibold text-foreground">
                Rien ne part sans votre accord
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </Figure>
  );
}
