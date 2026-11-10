'use client';

import { useRef } from 'react';
import { useInView } from '../tsf/tsf-motion';

export type Veil = 'dark' | 'light' | 'none';

export function GradientField({
  src,
  srcSet,
  softSrc,
  headVeil = 'none',
  footVeil = 'none',
  framing = 'cover',
}: {
  readonly src: string;
  readonly srcSet?: string;
  readonly softSrc?: string;
  readonly headVeil?: Veil;
  readonly footVeil?: Veil;
  readonly framing?: 'cover' | 'left';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { visible } = useInView(ref, 0);
  return (
    <div
      ref={ref}
      aria-hidden="true"
      data-running={visible ? '' : undefined}
      className="grad-field pointer-events-none absolute inset-0 overflow-hidden"
      data-framing={framing}
      style={{
        ['--grad' as string]: `url(${src})`,
        ['--grad-soft' as string]: `url(${softSrc ?? src})`,
      }}
    >
      {srcSet === undefined || framing !== 'cover' ? (
        <span className="grad-base" />
      ) : (
        <span className="grad-base" data-img="">
          {/* biome-ignore lint/performance/noImgElement: the hero picture, preloaded at its size. */}
          <img
            src={src}
            srcSet={srcSet}
            sizes="100vw"
            alt=""
            fetchPriority="high"
            decoding="async"
          />
        </span>
      )}
      <span className="grad-glide" />
      <span className="grad-grain" />
      {headVeil === 'none' ? null : <span className="grad-veil-head" data-veil={headVeil} />}
      {footVeil === 'none' ? null : <span className="grad-veil-foot" data-veil={footVeil} />}
    </div>
  );
}
