'use client';

import { cn } from '../../../ui/lib/utils';
import { useEffect, useRef, useState } from 'react';
import { formatCount } from '../../reactbits/TicketStubFooter';
import { useInView } from './tsf-motion';

const DIGITS = '0123456789'.split('');

export function TsfOdometer({
  value,
  className,
}: {
  readonly value: number | string;
  readonly className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const { seen } = useInView(ref, 0.4);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const rolled = !mounted || seen;
  const text = typeof value === 'number' ? formatCount(value) : value;
  const chars = text.split('');
  return (
    <span ref={ref} className={cn('tk-odo', className)}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className="inline-flex">
        {chars.map((ch, i) => {
          const key = chars.length - i;
          if (!/\d/.test(ch)) return <span key={`s${key}`}>{ch}</span>;
          const shift = rolled ? -Number(ch) * 10 : 0;
          return (
            <span className="tk-odo-d" key={key}>
              <span
                className="tk-odo-s"
                style={{ transform: `translateY(${shift}%)`, transitionDelay: `${i * 60}ms` }}
              >
                {DIGITS.map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </span>
            </span>
          );
        })}
      </span>
    </span>
  );
}
