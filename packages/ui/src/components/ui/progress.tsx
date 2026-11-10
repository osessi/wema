"use client";

import { Progress as ProgressPrimitive } from "radix-ui";
import type * as React from "react";
import { cn } from "../../lib/utils";

/*
 * Barre de progression : piste atténuée de 6 px, remplissage jaune.
 * `tone="ink"` remplit en encre (noir, ou blanc cassé en sombre) quand le jaune
 * manque de contraste sur le fond.
 */
function Progress({
  className,
  value,
  tone = "brand",
  indicatorClassName,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & {
  tone?: "brand" | "ink";
  indicatorClassName?: string;
}) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      data-tone={tone}
      className={cn(
        "relative h-1.5 w-full overflow-hidden rounded-full bg-muted shadow-[inset_0_0_0_1px_var(--border)]",
        className,
      )}
      value={value}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn(
          "h-full w-full flex-1 rounded-full transition-transform duration-500 ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none",
          tone === "brand" ? "bg-brand" : "bg-foreground",
          indicatorClassName,
        )}
        style={{ transform: `translateX(-${100 - (value ?? 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
