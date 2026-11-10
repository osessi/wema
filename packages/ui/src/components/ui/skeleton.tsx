import { cn } from "../../lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "animate-pulse rounded-control bg-muted motion-reduce:animate-none dark:bg-foreground/10",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
