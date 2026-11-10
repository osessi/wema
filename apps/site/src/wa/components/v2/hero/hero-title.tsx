'use client';

import { cn } from '../../../ui/lib/utils';
import { useEffect, useState } from 'react';
import { TYPE } from '../../reactbits/TicketStubFooter';

export interface HeroTitleSegment {
  readonly text: string;
  readonly className?: string;
}

const CARET_HOLD_MS = 2_600;
const LOADER_FALLBACK_MS = 6_500;

function whenLoaderDone(onDone: () => void): () => void {
  const loader = document.querySelector('section[aria-busy]');
  let fired = false;
  const fire = () => {
    if (fired) return;
    fired = true;
    onDone();
  };
  if (loader === null || loader.getAttribute('aria-busy') === 'false') {
    const id = window.setTimeout(fire, 120);
    return () => window.clearTimeout(id);
  }
  const watch = new MutationObserver(() => {
    if (loader.getAttribute('aria-busy') === 'false') fire();
  });
  watch.observe(loader, { attributes: true, attributeFilter: ['aria-busy'] });
  const fallback = window.setTimeout(fire, LOADER_FALLBACK_MS);
  return () => {
    watch.disconnect();
    window.clearTimeout(fallback);
  };
}

function Caret() {
  return (
    <span
      aria-hidden="true"
      className="hero-caret visible absolute top-[0.12em] left-full ml-[0.04em] h-[0.84em] w-[0.34em] bg-[#ffc529]"
    />
  );
}

export function HeroTitle({
  segments,
  className,
}: {
  readonly segments: readonly HeroTitleSegment[];
  readonly className?: string;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.text.length, 0);
  const [typed, setTyped] = useState<number | null>(null);
  const [caret, setCaret] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setTyped(0);
    setCaret(true);
    let interval = 0;
    let hold = 0;
    const stop = whenLoaderDone(() => {
      const start = performance.now();
      interval = window.setInterval(() => {
        const count = Math.min(total, Math.floor((performance.now() - start) / TYPE.type) + 1);
        setTyped(count);
        if (count >= total) {
          window.clearInterval(interval);
          hold = window.setTimeout(() => {
            setTyped(null);
            setCaret(false);
          }, CARET_HOLD_MS);
        }
      }, 30);
    });
    return () => {
      stop();
      window.clearInterval(interval);
      window.clearTimeout(hold);
    };
  }, [total]);

  const full = segments.map((segment) => segment.text).join('');
  const shown = typed ?? total;
  const caretAt = caret ? Math.max(shown, 1) - 1 : -1;
  const caretBefore = caret && shown === 0;

  let offset = 0;
  return (
    <h1 aria-label={full} className={className}>
      {segments.map((segment) => {
        const start = offset;
        offset += segment.text.length;
        const visible = Math.max(0, Math.min(segment.text.length, shown - start));
        const local = caretAt - start;
        const owns = local >= 0 && local < segment.text.length;
        const head = segment.text.slice(0, owns ? local : visible);
        const mark = owns ? segment.text.charAt(local) : '';
        const tail = segment.text.slice(owns ? local + 1 : visible);
        return (
          <span key={segment.text} aria-hidden="true" className={segment.className}>
            {head}
            {owns ? (
              <span className={cn('relative', caretBefore && 'invisible')}>
                {mark}
                {caretBefore ? (
                  <span
                    aria-hidden="true"
                    className="hero-caret visible absolute top-[0.12em] left-0 h-[0.84em] w-[0.34em] bg-[#ffc529]"
                  />
                ) : (
                  <Caret />
                )}
              </span>
            ) : null}
            {tail === '' ? null : <span className="invisible">{tail}</span>}
          </span>
        );
      })}
    </h1>
  );
}
