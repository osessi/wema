'use client';

import { type RefObject, useEffect, useState } from 'react';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}

export function useInView(
  ref: RefObject<Element | null>,
  threshold = 0.2,
): { readonly seen: boolean; readonly visible: boolean } {
  const [state, setState] = useState({ seen: false, visible: false });
  useEffect(() => {
    const node = ref.current;
    if (node === null) return;
    if (typeof IntersectionObserver === 'undefined') {
      setState({ seen: true, visible: true });
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = entry?.isIntersecting ?? false;
        setState((prev) => ({ seen: prev.seen || visible, visible }));
      },
      { threshold },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, threshold]);
  return state;
}
