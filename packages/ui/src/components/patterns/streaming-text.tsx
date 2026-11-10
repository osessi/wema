"use client";

/**
 * Texte du prof IA qui arrive mot à mot.
 *
 * Chaque mot apparaît en jaune lisible (`--brand-text`) un court instant puis se pose en
 * encre : la traînée marque ce qui vient d'arriver. Un point jaune suit la tête du flux.
 * Seulement pour un texte réellement produit maintenant, jamais pour rejouer un message
 * déjà reçu. Une fois tous les mots posés, le texte est rendu tel quel (copie propre).
 *
 * Source : ZeroAds `packages/ui/src/patterns/streaming-text.tsx` (code d'Olivier), lui-même
 * repris d'iconiq `streaming-text` (MIT) : découpage, planification absolue (pas de dérive),
 * chemin sans animation. Adapté à Wema : jaune de marque au lieu du violet.
 *
 * Props :
 * - `text` : le texte (les retours à la ligne sont gardés).
 * - `speed` (ms entre deux mots, 90), `delay` (ms, 0), `settleDelay` (ms en jaune, 320).
 * - `showCursor` (vrai), `onComplete()`.
 * Sans animation si l'utilisateur réduit les animations : le texte entier tout de suite.
 */
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Fragment,
  type HTMLAttributes,
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "../../lib/utils";
import { RETURN } from "../brand/motion";

export interface StreamingTextProps extends HTMLAttributes<HTMLSpanElement> {
  readonly text: string;
  readonly speed?: number | undefined;
  readonly delay?: number | undefined;
  readonly settleDelay?: number | undefined;
  readonly showCursor?: boolean | undefined;
  readonly onComplete?: (() => void) | undefined;
}

type Token = { type: "word"; value: string } | { type: "break"; value: string };

export function tokenizeStream(text: string): Token[] {
  const tokens: Token[] = [];
  for (const part of text.split(/(\n+)/)) {
    if (part.startsWith("\n"))
      tokens.push({ type: "break", value: part.length > 1 ? "\n\n" : "\n" });
    else
      for (const word of part.split(/\s+/))
        if (word) tokens.push({ type: "word", value: word });
  }
  return tokens;
}

const ENTER = 0.45;
const SETTLE = 0.4;

const Word = memo(function Word({
  word,
  settleDelay,
}: {
  word: string;
  settleDelay: number;
}) {
  const settle = { delay: settleDelay / 1000, duration: SETTLE, ease: RETURN };
  return (
    <motion.span
      className="inline-grid align-baseline"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: ENTER, ease: RETURN }}
    >
      <motion.span
        className="col-start-1 row-start-1 text-foreground"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={settle}
      >
        {word}
      </motion.span>
      <motion.span
        className="col-start-1 row-start-1 text-brand-text"
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={settle}
      >
        {word}
      </motion.span>
    </motion.span>
  );
});

export function StreamingText({
  className,
  text,
  speed = 90,
  delay = 0,
  settleDelay = 320,
  showCursor = true,
  onComplete,
  ...props
}: StreamingTextProps) {
  const tokens = useMemo(() => tokenizeStream(text), [text]);
  const [count, setCount] = useState(0);
  const reduce = useReducedMotion() ?? false;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const startRef = useRef(0);

  const [prevText, setPrevText] = useState(text);
  const [settled, setSettled] = useState(false);
  if (prevText !== text) {
    setPrevText(text);
    setCount(0);
    setSettled(false);
  }

  useEffect(() => {
    if (reduce || tokens.length === 0 || count >= tokens.length) return;
    if (count === 0) startRef.current = performance.now();
    const target = startRef.current + delay + (count + 1) * Math.max(speed, 16);
    const timer = setTimeout(
      () => {
        setCount(count + 1);
        if (count + 1 >= tokens.length) onCompleteRef.current?.();
      },
      Math.max(0, target - performance.now()),
    );
    return () => clearTimeout(timer);
  }, [count, tokens.length, speed, delay, reduce]);

  useEffect(() => {
    if (reduce && tokens.length > 0) onCompleteRef.current?.();
  }, [reduce, tokens]);

  const streaming = !reduce && count < tokens.length;

  useEffect(() => {
    if (streaming || settled || tokens.length === 0) return;
    const timer = setTimeout(
      () => setSettled(true),
      settleDelay + (ENTER + SETTLE) * 1000,
    );
    return () => clearTimeout(timer);
  }, [streaming, settled, tokens.length, settleDelay]);

  return (
    <span
      className={cn("whitespace-pre-wrap text-foreground", className)}
      data-slot="streaming-text"
      {...props}
    >
      {reduce || settled ? (
        text
      ) : (
        <>
          <span className="sr-only">{text}</span>
          <span aria-hidden>
            {tokens.slice(0, count).map((token, index) =>
              token.type === "break" ? (
                // biome-ignore lint/suspicious/noArrayIndexKey: les jetons viennent de `text` et ne font que s'ajouter
                <span key={`b${index}`}>{token.value}</span>
              ) : (
                // biome-ignore lint/suspicious/noArrayIndexKey: les jetons viennent de `text` et ne font que s'ajouter
                <Fragment key={`w${index}`}>
                  <Word word={token.value} settleDelay={settleDelay} />{" "}
                </Fragment>
              ),
            )}
            {showCursor ? (
              <AnimatePresence>
                {streaming ? (
                  <motion.span
                    className="inline-block size-[0.5em] rounded-full bg-brand align-baseline"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0.35, 1, 0.35] }}
                    exit={{ opacity: 0 }}
                    transition={{
                      opacity: {
                        duration: 1.1,
                        repeat: Number.POSITIVE_INFINITY,
                        ease: "easeInOut",
                      },
                    }}
                  />
                ) : null}
              </AnimatePresence>
            ) : null}
          </span>
        </>
      )}
    </span>
  );
}
