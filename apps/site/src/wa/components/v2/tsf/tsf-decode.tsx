'use client';

import { cn } from '../../../ui/lib/utils';
import { type ElementType, useEffect, useRef, useState } from 'react';
import { scramble } from '../../reactbits/TicketStubFooter';
import { useInView, useReducedMotion } from './tsf-motion';

export function TsfDecode({
  text,
  as: Tag = 'span',
  duration = 1100,
  className,
}: {
  readonly text: string;
  readonly as?: ElementType;
  readonly duration?: number;
  readonly className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const { seen } = useInView(ref, 0.5);
  const [shown, setShown] = useState(text);
  const done = useRef(false);

  useEffect(() => {
    if (reduced || done.current) {
      setShown(text);
      return;
    }
    if (!seen) {
      setShown(scramble(text, 0, 0));
      return;
    }
    done.current = true;
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const p = (now - start) / duration;
      setShown(scramble(text, p, Math.floor((now - start) / 45)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [text, reduced, seen, duration]);

  return (
    <Tag ref={ref} className={cn('font-mono', className)}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">{shown}</span>
    </Tag>
  );
}
