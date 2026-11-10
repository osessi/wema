"use client";

import { useAnimation, useReducedMotion } from "motion/react";
import { type DOMAttributes, useCallback, useEffect, useRef } from "react";

export interface IconMotionController {
  readonly controls: ReturnType<typeof useAnimation>;
  readonly ambient: boolean;
  readonly start: () => void;
  readonly stop: () => void;
  readonly bind: Pick<
    DOMAttributes<Element>,
    "onMouseEnter" | "onMouseLeave" | "onFocus" | "onBlur"
  >;
}

export function useIconMotion(): IconMotionController {
  const controls = useAnimation();
  const ambient = !(useReducedMotion() ?? false);
  const playing = useRef(false);

  const start = useCallback(() => {
    if (playing.current) return;
    playing.current = true;
    void controls.start("animate").then(() => {
      if (playing.current) controls.set("normal");
      playing.current = false;
    });
  }, [controls]);

  const stop = useCallback(() => {
    playing.current = false;
    void controls.start("normal");
  }, [controls]);

  useEffect(
    () => () => {
      playing.current = false;
    },
    [],
  );

  return {
    controls,
    ambient,
    start,
    stop,
    bind: {
      onMouseEnter: start,
      onMouseLeave: stop,
      onFocus: start,
      onBlur: stop,
    },
  };
}
