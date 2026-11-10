"use client";

/**
 * Copie adaptée de `wa/components/v2/journey/journey-stack.tsx` : mêmes fiches
 * empilées au défilement, avec deux rangées de pastilles sous chaque fiche
 * (« Vous décidez » et « Adapté à chaque élève »).
 */

import type { ComponentType, ReactNode, Ref } from "react";
import ScrollStack, {
  ScrollStackItem,
} from "../../wa/components/reactbits/ScrollStack";
import { GlowIcon } from "../../wa/components/v2/glow-icon";
import { TONE_HEX } from "../../wa/components/v2/journey/figure";
import s from "../../wa/components/v2/journey/journey.module.css";
import { TsfFrame } from "../../wa/components/v2/tsf/tsf-frame";
import { TsfTitle } from "../../wa/components/v2/tsf/tsf-title";
import type { GlowTone } from "../../wa/ui/components/ui/glow-tile";
import type { AnimatedIconHandle, AnimatedIconProps } from "../../wa/ui/icons";

export type MethodCard = {
  readonly id: string;
  readonly name: string;
  readonly tone: GlowTone;
  readonly icon: ComponentType<
    AnimatedIconProps & { ref?: Ref<AnimatedIconHandle> }
  >;
  readonly title: readonly ReactNode[];
  readonly body: string;
  readonly youSet: readonly string[];
  readonly adapted: readonly string[];
  readonly Figure: ComponentType<{ readonly index: number }>;
};

function Pills({
  label,
  items,
  tone,
  outline,
}: {
  label: string;
  items: readonly string[];
  tone: GlowTone;
  outline: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 border-b border-[var(--tk-rule)] pb-2 font-mono text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
        <span
          className="tk-diamond"
          {...(outline ? { "data-outline": "" } : {})}
          aria-hidden="true"
        />
        {label}
      </div>
      <ul className="mt-3 flex flex-wrap gap-1.5">
        {items.map((item) =>
          outline ? (
            <li
              key={item}
              className="rounded-full px-2.5 py-1 text-[12.5px] font-semibold text-[#15160F]"
              style={{ backgroundColor: TONE_HEX[tone] }}
            >
              {item}
            </li>
          ) : (
            <li
              key={item}
              className="rounded-full border border-[var(--tk-edge)] px-2.5 py-1 text-[12.5px] font-semibold text-foreground/85"
            >
              {item}
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

export function MethodStack({
  steps,
}: {
  readonly steps: readonly MethodCard[];
}) {
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
                aria-labelledby={`method-${step.id}-title`}
                className={`${s.cardBody} grid gap-8 p-5 sm:p-8 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:gap-10 lg:p-10`}
              >
                <div className="flex min-w-0 flex-col">
                  <div className="flex items-center gap-3">
                    <GlowIcon
                      tone={step.tone}
                      icon={step.icon}
                      size={44}
                      idle="breathe"
                    />
                    <span className="flex items-baseline gap-2 font-mono text-[12px] tracking-[0.08em] text-muted-foreground uppercase">
                      <span className="text-[15px] font-semibold text-foreground tabular-nums">
                        {index + 1}
                        <span className="text-muted-foreground">
                          /{steps.length}
                        </span>
                      </span>
                      <span aria-hidden="true">·</span>
                      {step.name}
                    </span>
                  </div>
                  <TsfTitle
                    as="h3"
                    id={`method-${step.id}-title`}
                    lines={step.title}
                    className="mt-7 text-balance text-[32px] leading-[1.04] text-foreground sm:text-[40px] lg:mt-7 lg:text-[38px]"
                  />
                  <p className="mt-5 max-w-[440px] text-pretty text-[16px] leading-relaxed font-medium text-foreground/70">
                    {step.body}
                  </p>
                  <div className="mt-7 flex flex-col gap-5 lg:mt-auto">
                    <Pills
                      label="Vous décidez"
                      items={step.youSet}
                      tone={step.tone}
                      outline
                    />
                    <Pills
                      label="Adapté à chaque élève"
                      items={step.adapted}
                      tone={step.tone}
                      outline={false}
                    />
                  </div>
                </div>
                <div className="min-h-[380px] min-w-0 sm:min-h-[420px] lg:min-h-0">
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
