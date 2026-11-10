import { cn } from '../../../ui/lib/utils';
import type { ReactNode } from 'react';
import { TsfDiamond } from './tsf-rule';

export function TsfFrame({
  children,
  className,
  innerClassName,
  tone = 'surface',
  marks = true,
}: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly innerClassName?: string;
  readonly tone?: 'surface' | 'graphite';
  readonly marks?: boolean;
}) {
  return (
    <div className={cn('tk-frame', className)}>
      <div
        className={cn(
          'tk-frame-cut h-full overflow-hidden',
          tone === 'graphite' ? 'graphite bg-[#151610] text-[#F5F6F0]' : 'bg-surface',
          innerClassName,
        )}
        data-theme={tone === 'graphite' ? 'dark' : undefined}
      >
        {children}
        <span aria-hidden="true" className="tk-frame-rim" />
      </div>
      {marks ? (
        <>
          <span aria-hidden="true" className="tk-frame-mark" data-at="tr">
            <TsfDiamond outline />
          </span>
          <span aria-hidden="true" className="tk-frame-mark" data-at="bl">
            <TsfDiamond outline />
          </span>
        </>
      ) : null}
    </div>
  );
}
