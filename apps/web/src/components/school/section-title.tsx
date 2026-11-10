import { GlowTile, type GlowTone } from "@wema/ui/components/brand/glow-tile";
import type { ReactNode } from "react";

/** Titre de section de l'espace école : sur-titre mono, titre, pastille et complément à droite. */
export function SectionTitle({
  title,
  eyebrow,
  description,
  icon,
  tone = "slate",
  aside,
  as: Heading = "h2",
}: {
  title: ReactNode;
  eyebrow?: string | undefined;
  description?: ReactNode | undefined;
  icon?: ReactNode | undefined;
  tone?: GlowTone | undefined;
  aside?: ReactNode | undefined;
  as?: "h2" | "h3" | undefined;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        {icon ? (
          <GlowTile tone={tone} size={36}>
            {icon}
          </GlowTile>
        ) : null}
        <div className="min-w-0 space-y-1">
          {eyebrow ? (
            <p className="font-mono text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
              {eyebrow}
            </p>
          ) : null}
          <Heading className="text-lg font-semibold tracking-tight">
            {title}
          </Heading>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      {aside ? <div className="flex items-center gap-2">{aside}</div> : null}
    </div>
  );
}
