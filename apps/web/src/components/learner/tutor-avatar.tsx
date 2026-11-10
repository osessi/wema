import type { TutorAvatar as AvatarId } from "@wema/domain";
import { GlowTile, type GlowTone } from "@wema/ui/brand";
import type { ReactNode } from "react";

/** Ton de chaque avatar (palette chaude de Wema). */
export const AVATAR_TONES: Record<AvatarId, GlowTone> = {
  sun: "yellow",
  owl: "amber",
  leaf: "mint",
  cloud: "sky",
  star: "rose",
  initial: "slate",
};

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/** Petit visage commun : deux yeux et un sourire, centrés sur (cx, cy). */
function Face({ cx = 12, cy = 12 }: { cx?: number; cy?: number }) {
  return (
    <>
      <circle cx={cx - 2.2} cy={cy - 0.8} r={1} fill="currentColor" />
      <circle cx={cx + 2.2} cy={cy - 0.8} r={1} fill="currentColor" />
      <path d={`M${cx - 2.2} ${cy + 1.6}q2.2 2 4.4 0`} {...stroke} />
    </>
  );
}

/** Avatars dessinés, simples et chaleureux : aucune photo, aucune personne. */
const GLYPHS: Record<Exclude<AvatarId, "initial">, ReactNode> = {
  sun: (
    <>
      <circle cx={12} cy={12} r={6} {...stroke} />
      <path
        d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
        {...stroke}
      />
      <Face />
    </>
  ),
  owl: (
    <>
      <path d="M6 5l2 2.5M18 5l-2 2.5" {...stroke} />
      <path
        d="M5 13a7 7 0 0 1 14 0v3a6 6 0 0 1-6 6h-2a6 6 0 0 1-6-6z"
        {...stroke}
      />
      <circle cx={9.2} cy={12.5} r={2.3} {...stroke} />
      <circle cx={14.8} cy={12.5} r={2.3} {...stroke} />
      <circle cx={9.2} cy={12.5} r={0.8} fill="currentColor" />
      <circle cx={14.8} cy={12.5} r={0.8} fill="currentColor" />
      <path d="M11 16l1 1.4 1-1.4z" fill="currentColor" />
    </>
  ),
  leaf: (
    <>
      <path d="M4 20C4 10 10 4 20 4c0 10-6 16-16 16z" {...stroke} />
      <path d="M4 20l5-5" {...stroke} />
      <Face cx={13} cy={11} />
    </>
  ),
  cloud: (
    <>
      <path
        d="M7 18h10a4 4 0 0 0 .6-8 6 6 0 0 0-11.4 1.5A3.3 3.3 0 0 0 7 18z"
        {...stroke}
      />
      <Face cx={12} cy={13} />
    </>
  ),
  star: (
    <>
      <path
        d="M12 2.8l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.6l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z"
        {...stroke}
      />
      <Face cx={12} cy={11.5} />
    </>
  ),
};

/** Pastille du prof IA : l'avatar choisi, ou l'initiale de son prénom. */
export function TutorAvatar({
  avatar,
  name,
  size = 40,
  className,
}: {
  avatar: AvatarId;
  name: string;
  size?: number;
  className?: string;
}) {
  return (
    <GlowTile
      tone={AVATAR_TONES[avatar]}
      size={size}
      glyph={avatar === "initial" ? "70%" : "64%"}
      className={className}
    >
      {avatar === "initial" ? (
        <span
          className="font-display leading-none font-semibold"
          style={{ fontSize: size * 0.42 }}
        >
          {(name.trim()[0] ?? "?").toLocaleUpperCase("fr-FR")}
        </span>
      ) : (
        <svg viewBox="0 0 24 24" className="size-full" aria-hidden="true">
          {GLYPHS[avatar]}
        </svg>
      )}
    </GlowTile>
  );
}
