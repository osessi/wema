"use client";

import { useEffect, useState } from "react";

/** Vrai si l'utilisateur demande moins d'animations. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

/** `seen` : l'élément est déjà entré dans l'écran ; `visible` : il y est. */
export function useInView(
  node: Element | null,
  threshold = 0.2,
): { readonly seen: boolean; readonly visible: boolean } {
  const [state, setState] = useState({ seen: false, visible: false });
  useEffect(() => {
    if (node === null) return;
    if (typeof IntersectionObserver === "undefined") {
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
  }, [node, threshold]);
  return state;
}

/** Biseau en `clip-path` : coupe des coins haut-gauche, haut-droit, bas-droit, bas-gauche (px). */
export const chamfer = (tl: number, tr: number, br: number, bl: number) =>
  `polygon(${tl}px 0, calc(100% - ${tr}px) 0, 100% ${tr}px, 100% calc(100% - ${br}px), calc(100% - ${br}px) 100%, ${bl}px 100%, 0 calc(100% - ${bl}px), 0 ${tl}px)`;

export interface TypeTiming {
  readonly type: number;
  readonly hold: number;
  readonly erase: number;
  readonly gap: number;
}
export const TYPE: TypeTiming = { type: 55, hold: 2600, erase: 22, gap: 420 };

/** Texte affiché à l'instant `ms` d'une frappe en boucle sur plusieurs phrases. */
export function typeFrame(
  phrases: readonly string[],
  ms: number,
  k: TypeTiming = TYPE,
): { index: number; text: string } {
  const list = phrases.filter((p) => p.length > 0);
  if (list.length === 0) return { index: 0, text: "" };
  const spans = list.map(
    (p) => p.length * k.type + k.hold + p.length * k.erase + k.gap,
  );
  const total = spans.reduce((a, b) => a + b, 0);
  let t = Number.isFinite(ms) && total > 0 ? ((ms % total) + total) % total : 0;
  let i = 0;
  while (i < list.length - 1 && t >= (spans[i] ?? 0)) {
    t -= spans[i] ?? 0;
    i++;
  }
  const p = list[i] ?? "";
  const typing = p.length * k.type;
  if (t < typing)
    return { index: i, text: p.slice(0, Math.floor(t / k.type) + 1) };
  t -= typing;
  if (t < k.hold) return { index: i, text: p };
  t -= k.hold;
  const erasing = p.length * k.erase;
  if (t < erasing)
    return { index: i, text: p.slice(0, p.length - Math.floor(t / k.erase)) };
  return { index: i, text: "" };
}
