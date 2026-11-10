import { GlowTile, type GlowTone } from "@wema/ui/components/brand/glow-tile";
import type { ReactNode } from "react";

/** Bloc d'une page parent : pastille, sur-titre mono, titre, explication, contenu. */
export function Section({
  title,
  description,
  eyebrow,
  icon,
  tone = "slate",
  actions,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** Sur-titre en Geist Mono majuscule (« 01 — Hypothèses »). */
  eyebrow?: ReactNode;
  /** Glyphe Phosphor, placé dans une `GlowTile`. */
  icon?: ReactNode;
  tone?: GlowTone;
  /** Action alignée sur la ligne du titre. */
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-5 rounded-card border bg-card p-4 shadow-xs sm:p-6">
      <div className="flex flex-wrap items-start gap-4">
        {icon ? (
          <GlowTile tone={tone} size={40}>
            {icon}
          </GlowTile>
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {eyebrow ? (
            <p className="font-mono text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="text-xl font-normal tracking-tight">{title}</h2>
          {description && (
            <p className="max-w-3xl text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        ) : null}
      </div>
      {children}
    </section>
  );
}
