import { GlowTile, type GlowTone } from "@wema/ui/brand";
import { Card } from "@wema/ui/components/ui/card";
import { cn } from "@wema/ui/lib/utils";
import type { ReactNode } from "react";

/*
 * Briques de mise en page du back-office, sans état (utilisables côté serveur
 * comme côté client) : panneau titré avec pastille, sur-titre mono, liste de
 * définitions. Les textes arrivent tous en props.
 */

export interface PanelProps {
  /** Glyphe Phosphor placé dans une pastille `GlowTile` de 36 px. */
  icon?: ReactNode | undefined;
  tone?: GlowTone | undefined;
  title: ReactNode;
  /** Niveau du titre (le `h1` est celui de la page). */
  titleAs?: "h2" | "h3" | undefined;
  description?: ReactNode | undefined;
  /** Actions alignées à droite, sur la ligne du titre. */
  actions?: ReactNode | undefined;
  /** Contenu collé aux bords (tableau pleine largeur). */
  flush?: boolean | undefined;
  className?: string | undefined;
  contentClassName?: string | undefined;
  id?: string | undefined;
  children?: ReactNode;
}

/** Carte de section : pastille, titre, description et actions, puis contenu. */
export function Panel({
  icon,
  tone = "slate",
  title,
  titleAs: Title = "h2",
  description,
  actions,
  flush = false,
  className,
  contentClassName,
  id,
  children,
}: PanelProps) {
  return (
    <Card id={id} className={cn("min-w-0 gap-0 py-0", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 p-4 sm:p-6">
        <div className="flex min-w-[min(100%,16rem)] flex-1 items-start gap-3">
          {icon ? (
            <GlowTile tone={tone} size={36} className="mt-0.5">
              {icon}
            </GlowTile>
          ) : null}
          <div className="min-w-0 space-y-1">
            <Title className="text-base font-semibold tracking-tight">
              {title}
            </Title>
            {description ? (
              <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        ) : null}
      </div>
      {children !== undefined && children !== null ? (
        <div
          className={cn(
            flush
              ? "border-t [&_td:first-child]:pl-4 sm:[&_td:first-child]:pl-6 [&_td:last-child]:pr-4 sm:[&_td:last-child]:pr-6 [&_th:first-child]:pl-4 sm:[&_th:first-child]:pl-6 [&_th:last-child]:pr-4 sm:[&_th:last-child]:pr-6"
              : "px-4 pb-4 sm:px-6 sm:pb-6",
            contentClassName,
          )}
        >
          {children}
        </div>
      ) : null}
    </Card>
  );
}

/** Sur-titre mono en petites majuscules (statique, sans frappe). */
export function MonoLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <p
      className={cn(
        "font-mono text-[11px] font-medium tracking-[0.06em] text-muted-foreground uppercase",
        className,
      )}
    >
      {children}
    </p>
  );
}

/** Identifiant ou code en Geist Mono, sur une petite pilule. */
export function Code({
  children,
  className,
}: {
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <code
      className={cn(
        "inline-flex items-center rounded-[6px] bg-muted px-1.5 py-0.5 font-mono text-[12px] leading-4 text-foreground",
        className,
      )}
    >
      {children}
    </code>
  );
}

/** Paires libellé–valeur alignées sur deux colonnes. */
export function DefinitionList({
  items,
  className,
}: {
  items: { label: ReactNode; value: ReactNode; key: string }[];
  className?: string | undefined;
}) {
  return (
    <dl
      className={cn(
        "grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm",
        className,
      )}
    >
      {items.map((i) => (
        <div key={i.key} className="contents">
          <dt className="text-muted-foreground">{i.label}</dt>
          <dd className="min-w-0 break-words">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}
