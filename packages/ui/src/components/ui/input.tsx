import type * as React from "react";
import { cn } from "../../lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-control border border-input bg-card px-3 py-1 text-base text-foreground shadow-xs transition-[color,border-color,box-shadow] duration-150 outline-none selection:bg-brand selection:text-ink-on-brand placeholder:text-muted-foreground hover:border-foreground/35 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm motion-reduce:transition-none",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        "focus-visible:border-foreground focus-visible:ring-[3px] focus-visible:ring-brand/45",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
