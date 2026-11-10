import type * as React from "react";
import { cn } from "../../lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-control border border-input px-3 py-2 text-base text-foreground bg-[color-mix(in_srgb,var(--foreground)_2.5%,var(--card))] shadow-[inset_0_1px_2px_rgb(23_23_20/0.07),0_1px_0_rgb(255_255_255/0.7)] dark:bg-[color-mix(in_srgb,var(--foreground)_4%,var(--card))] dark:shadow-[inset_0_1px_2px_rgb(0_0_0/0.45),0_1px_0_rgb(255_255_255/0.03)] transition-[color,border-color,box-shadow] duration-150 outline-none placeholder:text-muted-foreground hover:border-foreground/35 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm motion-reduce:transition-none",
        "focus-visible:border-brand-active focus-visible:bg-card focus-visible:ring-[3px] focus-visible:ring-brand/40 dark:focus-visible:border-brand",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
