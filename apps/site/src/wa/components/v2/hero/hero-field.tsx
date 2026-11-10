'use client';

import { useRef } from 'react';
import { useInView } from '../tsf/tsf-motion';

export function HeroField() {
  const ref = useRef<HTMLDivElement>(null);
  const { visible } = useInView(ref, 0);
  return (
    <div
      ref={ref}
      aria-hidden="true"
      data-running={visible ? '' : undefined}
      className="hero-field pointer-events-none absolute inset-0 overflow-hidden"
    >
      <span className="hero-blob hero-blob-a" />
      <span className="hero-blob hero-blob-b" />
      <span className="hero-blob hero-blob-c" />
      <span className="hero-blob hero-blob-d" />
      <span className="hero-blob hero-blob-light" />
      <span className="hero-ribbon" />
      <span className="hero-sphere" />
      <span className="hero-grid" />
      <span className="hero-field-grain grain absolute inset-0" />
      <span className="hero-field-shade" />
    </div>
  );
}
