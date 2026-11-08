'use client';

import type { GlowTone } from '../../../ui/components/ui/glow-tile';
import type { AnimatedIconHandle, AnimatedIconProps } from '../../../ui/icons';
import type { ComponentType, ReactNode, Ref } from 'react';
import ScrollStack, { ScrollStackItem } from '../../reactbits/ScrollStack';
import { GlowIcon } from '../glow-icon';
import { TsfFrame } from '../tsf/tsf-frame';
import { TsfTitle } from '../tsf/tsf-title';
import { TONE_HEX } from './figure';
import s from './journey.module.css';

export type JourneyCard = {
  readonly id: string;
  readonly name: string;
  readonly tone: GlowTone;
  readonly icon: ComponentType<AnimatedIconProps & { ref?: Ref<AnimatedIconHandle> }>;
  readonly title: readonly ReactNode[];
  readonly body: string;
  readonly youSet: readonly string[];
  readonly Figure: ComponentType<{ readonly index: number }>;
};

export function JourneyStack({ steps }: { readonly steps: readonly JourneyCard[] }) {
  return (
    <ScrollStack
      className="mt-16 sm:mt-20"
      stackPosition={108}
      itemStackDistance={18}
      itemDistance={140}
      itemScale={0.045}
      dimAmount={0.12}
      holdDistance={260}
    >
      {steps.map((step, index) => (
        <ScrollStackItem key={step.id}>
          <div id={step.id} className="scroll-mt-28">
            <TsfFrame innerClassName="relative">
              <article
                aria-labelledby={`journey-${step.id}-title`}
                className={`${s.cardBody} grid gap-8 p-5 sm:p-8 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:gap-10 lg:p-10`}
              >
                <div className="flex min-w-0 flex-col">
                  <div className="flex items-center gap-3">
                    <GlowIcon tone={step.tone} icon={step.icon} size={44} idle="breathe" />
                    <span className="flex items-baseline gap-2 font-mono text-[12px] tracking-[0.08em] text-muted-foreground uppercase">
                      <span className="text-[15px] font-semibold text-foreground tabular-nums">
                        {index + 1}
                        <span className="text-muted-foreground">/{steps.length}</span>
                      </span>
                      <span aria-hidden="true">·</span>
                      {step.name}
                    </span>
                  </div>
                  <TsfTitle
                    as="h3"
                    id={`journey-${step.id}-title`}
                    lines={step.title}
                    className="mt-7 text-balance text-[34px] leading-[1.04] text-foreground sm:text-[42px] lg:mt-9 lg:text-[46px]"
                  />
                  <p className="mt-5 max-w-[440px] text-pretty text-[16px] leading-relaxed font-medium text-foreground/70 sm:text-[17px]">
                    {step.body}
                  </p>
                  <div className="mt-7 lg:mt-auto">
                    <div className="flex items-center gap-3 border-b border-[var(--tk-rule)] pb-2 font-mono text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
                      <span className="tk-diamond" data-outline="" aria-hidden="true" />
                      Vous décidez
                    </div>
                    <ul className="mt-3 flex flex-wrap gap-1.5">
                      {step.youSet.map((item) => (
                        <li
                          key={item}
                          className="rounded-full px-2.5 py-1 text-[12.5px] font-semibold text-[#15160F]"
                          style={{ backgroundColor: TONE_HEX[step.tone] }}
                        >
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="min-h-[360px] min-w-0 sm:min-h-[400px] lg:min-h-0">
                  <step.Figure index={index} />
                </div>
              </article>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-[4] bg-background opacity-[var(--scroll-stack-dim,0)]"
              />
            </TsfFrame>
          </div>
        </ScrollStackItem>
      ))}
    </ScrollStack>
  );
}
