"use client";

import {
  CheckCircleIcon,
  CircleNotchIcon,
  InfoIcon,
  WarningCircleIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import { useTheme } from "next-themes";
import type * as React from "react";
import { Toaster as Sonner, type ToasterProps, toast } from "sonner";

/*
 * Toasts Wema (Sonner). Le <Toaster /> est monté une fois dans
 * apps/web/src/app/layout.tsx. Pour afficher une confirmation :
 *
 *   import { toast } from "@wema/ui/components/ui/sonner";
 *   toast.success("Séance enregistrée");
 *   toast.error("Impossible d'enregistrer", { description: "Réessayez." });
 *
 * Ne réimportez pas `sonner` directement : apps/web n'en dépend pas.
 */
function toasterTheme(
  theme: string | undefined,
): NonNullable<ToasterProps["theme"]> {
  return theme === "light" || theme === "dark" ? theme : "system";
}

const toasterStyle: React.CSSProperties & Record<`--${string}`, string> = {
  "--normal-bg": "var(--popover)",
  "--normal-text": "var(--popover-foreground)",
  "--normal-border": "var(--border)",
  "--border-radius": "10px",
};

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme();

  return (
    <Sonner
      theme={toasterTheme(theme)}
      className="toaster group"
      icons={{
        success: (
          <CheckCircleIcon weight="fill" className="size-[18px] text-success" />
        ),
        info: <InfoIcon weight="fill" className="size-[18px] text-info" />,
        warning: (
          <WarningIcon weight="fill" className="size-[18px] text-warning" />
        ),
        error: (
          <WarningCircleIcon
            weight="fill"
            className="size-[18px] text-destructive"
          />
        ),
        loading: (
          <CircleNotchIcon className="size-[18px] animate-spin motion-reduce:animate-none" />
        ),
      }}
      toastOptions={{
        classNames: {
          toast: "!gap-3 !border-border !shadow-md",
          title: "!font-medium",
          description: "!text-muted-foreground",
        },
      }}
      style={toasterStyle}
      {...props}
    />
  );
};

export { Toaster, toast };
