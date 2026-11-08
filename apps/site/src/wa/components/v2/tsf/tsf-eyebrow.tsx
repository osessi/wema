'use client';

import { cn } from '../../../ui/lib/utils';
import { useEffect, useRef, useState } from 'react';
import { TYPE, typeFrame } from '../../reactbits/TicketStubFooter';
import { useInView, useReducedMotion } from './tsf-motion';

export function TsfEyebrow({
  phrases,
  className,
}: {
  readonly phrases: readonly string[];
  readonly className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { seen, visible } = useInView(ref, 0.6);
  const list = phrases.filter((p) => p.length > 0);
  const first = list[0] ?? '';
  const loop = list.length > 1;
  const [ms, setMs] = useState<number | null>(null);
  const elapsed = useRef(0);

  useEffect(() => {
    if (reduced) return;
    if (!seen) {
      setMs(0);
      return;
    }
    if (!loop && elapsed.current >= first.length * TYPE.type) return;
    if (loop && !visible) return;
    const start = performance.now() - elapsed.current;
    const id = window.setInterval(() => {
      elapsed.current = performance.now() - start;
      setMs(elapsed.current);
      if (!loop && elapsed.current >= first.length * TYPE.type) window.clearInterval(id);
    }, 40);
    return () => window.clearInterval(id);
  }, [reduced, seen, visible, loop, first.length]);

  let text = first;
  if (!reduced && ms !== null) {
    text = loop
      ? typeFrame([...list], ms).text
      : seen
        ? first.slice(0, Math.min(first.length, Math.floor(ms / TYPE.type) + 1))
        : '';
  }

  return (
    <div ref={ref} className={cn('tk-eyebrow', className)}>
      <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">
        <path d="M6 1 11 6 6 11 1 6Z" fill="none" stroke="currentColor" strokeWidth="1.2" />
      </svg>
      <span className="sr-only">{first}</span>
      <span className="tk-type" aria-hidden="true">
        {text}
        {reduced ? null : <span className="tk-caret" />}
      </span>
      <span className="tk-dots" aria-hidden="true" />
    </div>
  );
}
