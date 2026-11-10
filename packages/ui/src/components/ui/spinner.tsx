import { CircleNotchIcon } from "@phosphor-icons/react/ssr";
import type * as React from "react";
import { cn } from "../../lib/utils";

/* Indicateur de chargement. Passez `aria-label` pour préciser ce qui charge. */
function Spinner({
  className,
  "aria-label": ariaLabel = "Chargement",
  ...props
}: React.ComponentProps<typeof CircleNotchIcon>) {
  return (
    <CircleNotchIcon
      role="status"
      aria-label={ariaLabel}
      className={cn(
        "size-4 animate-spin motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  );
}

export { Spinner };
