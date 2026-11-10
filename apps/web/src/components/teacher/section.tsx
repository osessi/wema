import { cn } from "@wema/ui/lib/utils";
import type { ReactNode } from "react";

/**
 * Tête de section de l'espace prof : sur-titre mono en capitales, titre `h2`
 * et actions alignées sur la ligne du titre.
 */
export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  actions,
  as: Title = "h2",
  className,
}: {
  id?: string | undefined;
  eyebrow?: string | undefined;
  title: ReactNode;
  description?: ReactNode | undefined;
  actions?: ReactNode | undefined;
  as?: "h2" | "h3" | undefined;
  className?: string | undefined;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-between gap-x-4 gap-y-2",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        {eyebrow ? <MonoLabel>{eyebrow}</MonoLabel> : null}
        <Title
          id={id}
          className="text-lg font-semibold tracking-tight text-balance"
        >
          {title}
        </Title>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

/** Étiquette Geist Mono en petites capitales. */
export function MonoLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "font-mono text-[11px] font-medium tracking-wider text-muted-foreground uppercase",
        className,
      )}
    >
      {children}
    </p>
  );
}

/** Initiales d'un nom (deux lettres au plus). */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

/** Pastille ronde à initiales (décorative : le nom est écrit à côté). */
export function InitialsAvatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-7 shrink-0 place-items-center rounded-full bg-muted font-mono text-[10px] font-semibold text-muted-foreground",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
