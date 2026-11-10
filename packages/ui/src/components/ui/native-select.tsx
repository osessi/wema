import { CaretDownIcon } from "@phosphor-icons/react/ssr";
import type * as React from "react";
import { cn } from "../../lib/utils";

/*
 * Liste déroulante native (<select>). Elle reste native à dessein : les tests
 * e2e lisent ses <option>, et elle offre le sélecteur du système sur mobile.
 */
function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <div
      className="group/native-select relative w-full has-[select:disabled]:opacity-50"
      data-slot="native-select-wrapper"
    >
      <select
        data-slot="native-select"
        className={cn(
          "h-9 w-full min-w-0 appearance-none rounded-control border border-input px-3 py-2 pr-9 text-sm text-foreground bg-[color-mix(in_srgb,var(--foreground)_2.5%,var(--card))] shadow-[inset_0_1px_2px_rgb(23_23_20/0.07),0_1px_0_rgb(255_255_255/0.7)] dark:bg-[color-mix(in_srgb,var(--foreground)_4%,var(--card))] dark:shadow-[inset_0_1px_2px_rgb(0_0_0/0.45),0_1px_0_rgb(255_255_255/0.03)] transition-[color,border-color,box-shadow] duration-150 outline-none hover:border-foreground/35 disabled:pointer-events-none disabled:cursor-not-allowed motion-reduce:transition-none",
          "focus-visible:border-brand-active focus-visible:bg-card focus-visible:ring-[3px] focus-visible:ring-brand/40 dark:focus-visible:border-brand",
          "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
          className,
        )}
        {...props}
      />
      <CaretDownIcon
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground select-none"
        aria-hidden="true"
        data-slot="native-select-icon"
      />
    </div>
  );
}

function NativeSelectOption({ ...props }: React.ComponentProps<"option">) {
  return <option data-slot="native-select-option" {...props} />;
}

export { NativeSelect, NativeSelectOption };
