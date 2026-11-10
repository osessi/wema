"use client";

/**
 * Une balle jaune qui traverse une rangée de barres, les barres se levant à son passage :
 * le chargement d'une attente notable (le diagnostic qui se calcule, le programme qui se
 * prépare), là où un `Spinner` la sous-estimerait. À utiliser avec parcimonie.
 *
 * Source : ZeroAds `packages/ui/src/patterns/wave-loader.tsx` (code d'Olivier), lui-même
 * repris d'Amicro `wave-physics-loader` (MIT, Subhan-code) : la physique précalculée
 * (rebond, écrasement, vague) telle quelle. Adapté à Wema : balle en jaune `--brand`,
 * barres en encre à opacité variable (justes en clair et en sombre).
 * Barres au repos si l'utilisateur réduit les animations.
 *
 * Props : `size` (`sm` | `md`), `label` (nom accessible, « Chargement en cours »).
 */
import { motion, useReducedMotion } from "motion/react";
import { useMemo } from "react";
import { cn } from "../../lib/utils";

const BARS = 15;
const BAR_W = 10;
const GAP = 6;
const PITCH = BAR_W + GAP;
const FRAMES = 121;
const BOUNCES = 4;
const MAX_BOUNCE = 48;
const BASE_H = 12;
const PEAK_H = 38;
const DURATION = 4;

interface Frames {
  bars: { heights: number[]; opacities: number[] }[];
  x: number[];
  y: number[];
  sx: number[];
  sy: number[];
  times: number[];
}

function compute(): Frames {
  const bars = Array.from({ length: BARS }, (): Frames["bars"][number] => ({
    heights: [],
    opacities: [],
  }));
  const x: number[] = [];
  const y: number[] = [];
  const sx: number[] = [];
  const sy: number[] = [];
  const times: number[] = [];
  for (let k = 0; k < FRAMES; k += 1) {
    const t = k / (FRAMES - 1);
    times.push(t);
    const xf = t < 0.5 ? t / 0.5 : (1 - t) / 0.5;
    const ballIndex = xf * (BARS - 1);
    x.push(ballIndex * PITCH);
    let bounce = (xf * BOUNCES) % 1;
    if (xf === 1 || xf === 0) bounce = 0;
    const bounceH = 4 * bounce * (1 - bounce);
    const heightFactor = Math.max(0, 1 - bounceH * 2);
    const indent = heightFactor * 16;
    y.push(-(BASE_H + PEAK_H - indent + bounceH * MAX_BOUNCE));
    sy.push(1 - heightFactor * 0.3);
    sx.push(1 + heightFactor * 0.25);
    for (let i = 0; i < BARS; i += 1) {
      const dist = Math.abs(i - ballIndex);
      const wave = dist < 3 ? Math.cos((dist / 3) * (Math.PI / 2)) : 0;
      const dent =
        dist < 1.5
          ? Math.cos((dist / 1.5) * (Math.PI / 2)) * heightFactor * 16
          : 0;
      const bar = bars[i];
      if (bar) {
        bar.heights.push(Math.max(4, BASE_H + wave * PEAK_H - dent));
        bar.opacities.push(0.14 + wave * 0.86);
      }
    }
  }
  return { bars, x, y, sx, sy, times };
}

export interface WaveLoaderProps {
  readonly size?: "sm" | "md" | undefined;
  readonly label?: string | undefined;
  readonly className?: string | undefined;
}

export function WaveLoader({
  size = "md",
  label = "Chargement en cours",
  className,
}: WaveLoaderProps) {
  const frames = useMemo(compute, []);
  const still = useReducedMotion() ?? false;
  const loop = {
    duration: DURATION,
    repeat: Number.POSITIVE_INFINITY,
    times: frames.times,
    ease: "linear" as const,
  };
  const width = BARS * PITCH - GAP;
  const height = BASE_H + PEAK_H + MAX_BOUNCE + 8;
  const k = size === "sm" ? 0.5 : 1;

  return (
    <output
      aria-label={label}
      className={cn("relative inline-block", className)}
      data-slot="wave-loader"
      style={{ width: width * k, height: height * k }}
    >
      <span
        className="absolute bottom-0 left-0 flex origin-bottom-left items-end"
        style={{ width, height, gap: GAP, transform: `scale(${k})` }}
      >
        {frames.bars.map((bar, i) => (
          <motion.span
            // biome-ignore lint/suspicious/noArrayIndexKey: barres positionnelles
            key={i}
            className="origin-bottom rounded-full bg-foreground"
            style={{ width: BAR_W, height: BASE_H, opacity: 0.14 }}
            {...(still
              ? {}
              : { animate: { height: bar.heights, opacity: bar.opacities } })}
            transition={loop}
          />
        ))}
        <motion.span
          className="absolute bottom-0 left-0 z-10 size-[10px] origin-bottom rounded-full bg-brand"
          style={{ y: -(BASE_H + PEAK_H) }}
          {...(still
            ? {}
            : {
                animate: {
                  x: frames.x,
                  y: frames.y,
                  scaleX: frames.sx,
                  scaleY: frames.sy,
                },
              })}
          transition={loop}
        />
      </span>
    </output>
  );
}
