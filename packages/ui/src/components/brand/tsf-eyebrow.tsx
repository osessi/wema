"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";
import { TYPE, typeFrame, useInView, useReducedMotion } from "./tsf-motion";

export interface TsfEyebrowProps {
  /** Une phrase (tapée une fois) ou plusieurs (tapées en boucle). Seule la première est lue. */
  readonly phrases: readonly string[];
  /** Pointillés qui défilent après le texte. Vrai par défaut. */
  readonly dots?: boolean | undefined;
  /** Filet sous l'étiquette. Vrai par défaut. */
  readonly rule?: boolean | undefined;
  readonly className?: string | undefined;
}

/**
 * Étiquette mono du site : losange, texte tapé lettre à lettre avec un caret
 * jaune, pointillés. Le texte est lu une seule fois (en `sr-only`) ; la frappe
 * est décorative (`aria-hidden`). Sans animation si l'utilisateur le demande.
 */
export function TsfEyebrow({
  phrases,
  dots = true,
  rule = true,
  className,
}: TsfEyebrowProps) {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const reduced = useReducedMotion();
  const { seen, visible } = useInView(node, 0.6);
  const list = phrases.filter((p) => p.length > 0);
  const first = list[0] ?? "";
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
      if (!loop && elapsed.current >= first.length * TYPE.type)
        window.clearInterval(id);
    }, 40);
    return () => window.clearInterval(id);
  }, [reduced, seen, visible, loop, first.length]);

  let text = first;
  if (!reduced && ms !== null) {
    if (loop) text = typeFrame(list, ms).text;
    else
      text = seen
        ? first.slice(0, Math.min(first.length, Math.floor(ms / TYPE.type) + 1))
        : "";
  }
  const typing = !reduced && (loop || text.length < first.length);

  return (
    <div
      ref={setNode}
      className={cn("tk-eyebrow", className)}
      data-rule={rule ? undefined : "false"}
    >
      <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">
        <path
          d="M6 1 11 6 6 11 1 6Z"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="1.2"
        />
      </svg>
      <span className="sr-only">{first}</span>
      <span className="tk-type" aria-hidden="true">
        {text}
        {typing ? <span className="tk-caret" /> : null}
      </span>
      {dots ? <span className="tk-dots" aria-hidden="true" /> : null}
    </div>
  );
}
