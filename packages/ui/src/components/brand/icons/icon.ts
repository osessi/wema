import type { HTMLAttributes } from "react";

export interface AnimatedIconHandle {
  start: () => void;
  stop: () => void;
}

export interface AnimatedIconProps extends HTMLAttributes<HTMLSpanElement> {
  size?: number | undefined;
}

export const PHOSPHOR_STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 16,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export const at = (x: number, y: number) =>
  ({ transformBox: "view-box", originX: x / 256, originY: y / 256 }) as const;
