import type * as React from "react";
import { cn } from "../../lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-control border border-input bg-card px-3 py-2 text-base text-foreground shadow-xs transition-[color,border-color,box-shadow] duration-150 outline-none placeholder:text-muted-foreground hover:border-foreground/35 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm motion-reduce:transition-none",
        "focus-visible:border-foreground focus-visible:ring-[3px] focus-visible:ring-brand/45",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
