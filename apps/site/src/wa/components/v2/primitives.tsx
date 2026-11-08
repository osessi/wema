import { cn } from '../../ui/lib/utils';
import type { ReactNode } from 'react';
import { TsfEyebrow } from './tsf/tsf-eyebrow';
import { TsfFrame } from './tsf/tsf-frame';
import { TsfTitle } from './tsf/tsf-title';

export function SectionHeading({
  eyebrow,
  title,
  sub,
  align = 'center',
  id,
  className,
}: {
  readonly eyebrow: string;
  readonly title: ReactNode;
  readonly sub?: ReactNode;
  readonly align?: 'center' | 'left';
  readonly id?: string;
  readonly className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-5',
        align === 'center' ? 'items-center text-center' : 'items-start text-left',
        className,
      )}
    >
      <TsfEyebrow phrases={[eyebrow]} />
      <TsfTitle
        {...(id === undefined ? {} : { id })}
        lines={title}
        className={cn(
          'text-balance text-[38px] leading-[1.06] text-foreground sm:text-[54px] lg:text-[64px]',
          align === 'center' ? 'max-w-[900px]' : 'max-w-[640px]',
        )}
      />
      {sub === undefined ? null : (
        <p
          className={cn(
            'text-pretty text-[17px] leading-relaxed font-medium text-foreground/75 sm:text-[19px]',
            align === 'center' ? 'max-w-[620px]' : 'max-w-[520px]',
          )}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

export function Frame({
  children,
  className,
  innerClassName,
  tone = 'surface',
}: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly innerClassName?: string;
  readonly tone?: 'surface' | 'graphite';
}) {
  return (
    <TsfFrame
      tone={tone}
      {...(className === undefined ? {} : { className })}
      {...(innerClassName === undefined ? {} : { innerClassName })}
    >
      {children}
    </TsfFrame>
  );
}

export function ContourFrame({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-[26px] border border-foreground/12 bg-[color-mix(in_srgb,var(--brand)_9%,var(--background))] p-2 shadow-[0_30px_80px_-40px_rgb(107_78_0/0.45)]',
        className,
      )}
    >
      <div className="h-full overflow-hidden rounded-[19px] border border-foreground/12 bg-surface [clip-path:inset(0_round_19px)]">
        {children}
      </div>
    </div>
  );
}
