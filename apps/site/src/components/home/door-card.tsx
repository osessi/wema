"use client";

/**
 * Copie de `doors/door-card.tsx` du site Winner : une « porte » par public,
 * avec son en-tête (pastille, index, titre) et une scène animée en dessous.
 */

import type { ComponentProps, ReactNode } from "react";
import { GlowIcon } from "../../wa/components/v2/glow-icon";
import { Frame } from "../../wa/components/v2/primitives";
import type { GlowTone } from "../../wa/ui/components/ui/glow-tile";
import { cn } from "../../wa/ui/lib/utils";

export function DoorCard({
  index,
  door,
  tone,
  icon,
  title,
  body,
  aside,
  children,
  className,
}: {
  readonly index: string;
  readonly door: string;
  readonly tone: GlowTone;
  readonly icon: ComponentProps<typeof GlowIcon>["icon"];
  readonly title: ReactNode;
  readonly body: string;
  readonly aside?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <Frame
      className={cn("flex flex-col", className)}
      innerClassName="flex h-full flex-col"
    >
      <div className="flex flex-col gap-5 px-5 pt-6 sm:px-7 sm:pt-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <GlowIcon tone={tone} icon={icon} size={40} idle="breathe" />
            <span className="font-mono text-[12px] font-medium tracking-[0.08em] text-foreground/60 uppercase">
              <span className="text-foreground">{index}</span>
              <span className="px-1.5 text-foreground/30">/</span>
              {door}
            </span>
          </div>
          {aside}
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="text-balance text-[25px] leading-[1.1] font-semibold tracking-[-0.03em] text-foreground sm:text-[30px]">
            {title}
          </h3>
          <p className="max-w-[52ch] text-pretty text-[15px] leading-relaxed text-foreground/65">
            {body}
          </p>
        </div>
      </div>
      <div className="flex flex-1 flex-col p-3 pt-6 sm:p-4 sm:pt-7">
        {children}
      </div>
    </Frame>
  );
}

export function Stage({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative flex flex-1 flex-col overflow-hidden rounded-[18px] border border-[var(--tk-line)] bg-background",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(color-mix(in_srgb,var(--foreground)_9%,transparent)_1px,transparent_1px)] [background-size:18px_18px]" />
      <div className="relative flex flex-1 flex-col">{children}</div>
    </div>
  );
}

export function Key({ children }: { readonly children: ReactNode }) {
  return <span className="text-brand-active dark:text-brand">{children}</span>;
}
