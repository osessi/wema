'use client';

import { cn } from '../../../ui/lib/utils';
import { type ElementType, type ReactNode, useRef } from 'react';
import { useInView } from './tsf-motion';

function titleLines(title: ReactNode): readonly ReactNode[] {
  if (typeof title !== 'string') return [title];
  return title.split(/(?<=[.!?])\s+/).filter((line) => line.length > 0);
}

export function TsfTitle({
  lines,
  as: Tag = 'h2',
  id,
  className,
}: {
  readonly lines: readonly ReactNode[] | ReactNode;
  readonly as?: ElementType;
  readonly id?: string;
  readonly className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const { seen } = useInView(ref, 0.3);
  const list: readonly ReactNode[] = Array.isArray(lines) ? lines : titleLines(lines);
  return (
    <Tag ref={ref} id={id} className={cn('tk-title', className)} data-seen={seen ? '1' : '0'}>
      {list.map((line, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the lines of one title never reorder.
        <span key={index}>
          <span style={{ transitionDelay: `${0.12 + index * 0.1}s` }}>{line}</span>
        </span>
      ))}
    </Tag>
  );
}
