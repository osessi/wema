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
          "h-9 w-full min-w-0 appearance-none rounded-control border border-input bg-card px-3 py-2 pr-9 text-sm text-foreground shadow-xs transition-[color,border-color,box-shadow] duration-150 outline-none hover:border-foreground/35 disabled:pointer-events-none disabled:cursor-not-allowed motion-reduce:transition-none",
          "focus-visible:border-foreground focus-visible:ring-[3px] focus-visible:ring-brand/45",
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
