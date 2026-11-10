import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";
import { cn } from "../../lib/utils";

/*
 * Pastille de statut, en pilule. Les variantes de statut s'appuient sur les
 * jetons `--<état>-soft` (fond) et `--<état>-text` (texte) ; tant qu'ils
 * manquent, elles retombent sur les tons pastel de la charte.
 */
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2.5 py-0.5 text-xs leading-4 font-medium whitespace-nowrap transition-[color,background-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background aria-invalid:border-destructive [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-foreground text-background [a&]:hover:bg-foreground/85",
        secondary:
          "bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/80",
        destructive:
          "bg-destructive text-white dark:text-background [a&]:hover:bg-destructive/90",
        outline: "border-border bg-card text-foreground [a&]:hover:bg-muted",
        ghost: "text-foreground [a&]:hover:bg-muted",
        link: "text-foreground underline-offset-4 [a&]:hover:underline",
        success: "bg-success-soft text-success-text",
        warning: "bg-warning-soft text-warning-text",
        danger: "bg-danger-soft text-danger-text",
        info: "bg-info-soft text-info-text",
        neutral: "border-border bg-muted text-muted-foreground",
        brand: "bg-brand-soft text-brand-text",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span";

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
