'use client';

import { useEffect, useRef, useState } from 'react';

export function useSceneStep<T extends HTMLElement>(
  steps: number,
  intervalMs: number,
  holdMs: number = intervalMs * 4,
) {
  const ref = useRef<T>(null);
  const [step, setStep] = useState(steps - 1);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (node === null) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry !== undefined) setVisible(entry.isIntersecting);
      },
      { threshold: 0.25 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let current = 0;
    setStep(0);
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const last = current >= steps - 1;
      timer = setTimeout(
        () => {
          current = last ? 0 : current + 1;
          setStep(current);
          tick();
        },
        last ? holdMs : intervalMs,
      );
    };
    tick();
    return () => clearTimeout(timer);
  }, [visible, steps, intervalMs, holdMs]);

  return { ref, step };
}

export function sceneReveal(shown: boolean): string {
  return shown
    ? 'translate-y-0 opacity-100 transition-all duration-500 ease-out'
    : 'pointer-events-none translate-y-2 opacity-0 transition-all duration-300 ease-out';
}

export function Logo({
  src,
  alt,
  className,
}: {
  readonly src: string;
  readonly alt: string;
  readonly className: string;
}) {
  return (
    // biome-ignore lint/performance/noImgElement: a small static logo, no optimisation needed.
    <img src={src} alt={alt} aria-hidden={alt === '' ? true : undefined} className={className} />
  );
}
