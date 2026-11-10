"use client";

/**
 * « Le prof réfléchit » : une goutte jaune qui respire entre un cercle et deux formes
 * souples, à côté d'un mot qui change avec un reflet qui le traverse. Les lecteurs
 * d'écran n'entendent qu'une annonce ; le défilement des mots est décoratif.
 *
 * Source : ZeroAds `packages/ui/src/patterns/thinking-indicator.tsx` (code d'Olivier),
 * lui-même repris d'iconiq `thinking-indicator` (MIT). Adapté à Wema : la goutte en
 * jaune de marque (`--brand`), reflet en encre, mots en français.
 * Différence avec `TypingIndicator` (chat) : celui-ci dit ce que fait le prof
 * (« Je relis ta réponse », « Je cherche un indice »).
 *
 * Props :
 * - `words` : les mots qui défilent (le premier est annoncé) ; un seul mot = fixe.
 * - `interval` (ms, 3000) ; `showIcon` (vrai). Immobile si l'utilisateur réduit les animations.
 */
import {
  AnimatePresence,
  type MotionStyle,
  motion,
  useReducedMotion,
} from "motion/react";
import {
  type CSSProperties,
  type HTMLAttributes,
  useEffect,
  useId,
  useState,
} from "react";
import { cn } from "../../lib/utils";
import { RETURN } from "../brand/motion";

const circle =
  "M 12 5 C 15.87 5 19 8.13 19 12 C 19 15.87 15.87 19 12 19 C 8.13 19 5 15.87 5 12 C 5 8.13 8.13 5 12 5 Z";
const blobA =
  "M 12 4.2 C 16.8 3.4 20.6 7.2 19.8 12 C 20.6 16.4 16.4 20.6 12 19.8 C 7.8 20.6 3.4 16.8 4.2 12 C 3.4 7.6 7.2 3.4 12 4.2 Z";
const blobB =
  "M 12 3.6 C 16.4 4.6 18.6 8 19.2 12 C 18.6 16.2 16.2 19.4 12 20.4 C 8 19.4 5.2 16.4 4.8 12 C 5.4 7.8 7.6 4.4 12 3.6 Z";

const CYCLE = 3.6;
const TIMES = [0, 0.3, 0.5, 0.7, 1];

export interface ThinkingIndicatorProps extends HTMLAttributes<HTMLDivElement> {
  readonly words: readonly string[];
  readonly interval?: number | undefined;
  readonly showIcon?: boolean | undefined;
}

export function ThinkingIndicator({
  className,
  words,
  interval = 3000,
  showIcon = true,
  ...props
}: ThinkingIndicatorProps) {
  const [index, setIndex] = useState(0);
  const gradientId = useId();
  const reduce = useReducedMotion() ?? false;
  const word = words.length > 0 ? (words[index % words.length] ?? "") : "";
  const longest = words.reduce((a, b) => (a.length >= b.length ? a : b), "");

  useEffect(() => {
    if (reduce || words.length <= 1) return;
    const timer = setInterval(
      () => setIndex((i) => (i + 1) % words.length),
      interval,
    );
    return () => clearInterval(timer);
  }, [reduce, words.length, interval]);

  const loop = {
    duration: CYCLE,
    ease: "easeInOut" as const,
    repeat: Number.POSITIVE_INFINITY,
    times: TIMES,
  };
  const spread: CSSProperties & Record<`--${string}`, string> = {
    "--ti-spread": `${word.length * 2}px`,
  };
  const sheen: MotionStyle = {
    backgroundImage:
      "linear-gradient(90deg, transparent calc(50% - var(--ti-spread)), var(--foreground), transparent calc(50% + var(--ti-spread))), linear-gradient(var(--muted-foreground), var(--muted-foreground))",
  };

  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-[0.55em] text-sm text-muted-foreground",
        className,
      )}
      data-slot="thinking-indicator"
      {...props}
    >
      {words.length > 0 ? <span className="sr-only">{words[0]}…</span> : null}
      {showIcon ? (
        <svg
          aria-hidden
          className="size-[1.4em] shrink-0 text-brand"
          fill="none"
          viewBox="0 0 24 24"
        >
          <defs>
            <linearGradient
              gradientUnits="userSpaceOnUse"
              id={gradientId}
              x1="5"
              x2="20"
              y1="4"
              y2="20"
            >
              <stop offset="0" stopColor="currentColor" stopOpacity="1" />
              <stop offset="1" stopColor="currentColor" stopOpacity="0.5" />
            </linearGradient>
          </defs>
          {reduce ? (
            <path d={circle} fill={`url(#${gradientId})`} />
          ) : (
            <motion.path
              d={circle}
              fill={`url(#${gradientId})`}
              initial={{ d: circle }}
              animate={{
                d: [circle, blobA, circle, blobB, circle],
                rotate: 360,
                scale: [0.86, 1, 0.9, 1, 0.86],
              }}
              style={{ transformBox: "view-box", transformOrigin: "center" }}
              transition={{
                d: loop,
                scale: loop,
                rotate: {
                  duration: CYCLE * 2,
                  ease: "linear",
                  repeat: Number.POSITIVE_INFINITY,
                },
              }}
            />
          )}
        </svg>
      ) : null}
      {words.length > 0 ? (
        <span
          aria-hidden
          className="inline-grid overflow-hidden"
          style={spread}
        >
          <span className="invisible col-start-1 row-start-1">{longest}</span>
          {reduce ? (
            <span className="col-start-1 row-start-1">{words[0]}</span>
          ) : (
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                key={word}
                className="col-start-1 row-start-1 bg-[length:250%_100%,auto] bg-clip-text text-transparent [background-repeat:no-repeat,padding-box]"
                initial={{
                  y: "70%",
                  opacity: 0,
                  filter: "blur(3px)",
                  backgroundPosition: "100% center",
                }}
                animate={{
                  y: 0,
                  opacity: 1,
                  filter: "blur(0px)",
                  backgroundPosition: "0% center",
                }}
                exit={{
                  y: "-70%",
                  opacity: 0,
                  filter: "blur(3px)",
                  transition: { duration: 0.2, ease: RETURN },
                }}
                style={sheen}
                transition={{
                  y: { type: "spring", stiffness: 420, damping: 34 },
                  opacity: { duration: 0.28, ease: RETURN },
                  filter: { duration: 0.28, ease: RETURN },
                  backgroundPosition: {
                    duration: 2,
                    ease: "linear",
                    repeat: Number.POSITIVE_INFINITY,
                  },
                }}
              >
                {word}
              </motion.span>
            </AnimatePresence>
          )}
        </span>
      ) : null}
    </div>
  );
}
