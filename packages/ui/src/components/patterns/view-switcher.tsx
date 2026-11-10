"use client";

/**
 * Plusieurs façons de lire les mêmes données (liste, cartes, calendrier) en onglets,
 * avec les commandes de la vue à droite sur la même ligne.
 *
 * Source : ZeroAds `packages/ui/src/patterns/view-switcher.tsx` (code d'Olivier), adapté à
 * Wema : onglets Radix de `ui/tabs`, la vue choisie est une surface claire qui glisse sur
 * une piste en creux (immobile si l'utilisateur réduit les animations), pas de jaune :
 * la façon de regarder une liste n'est pas l'action phare. Le panneau s'atténue pendant
 * le chargement au lieu de se vider.
 *
 * Props :
 * - `label` : nom accessible (« Vues de l'agenda ») ; `value`, `onValueChange`.
 * - `views` : `{ value, label, icon? }[]` (icônes Phosphor : `ListIcon`, `SquaresFourIcon`,
 *   `CalendarBlankIcon`…) ; `hideLabels` : icônes seules sous 640 px.
 * - `actions` : commandes à droite (filtres, une action).
 * - `pending` : la vue choisie arrive ; `children` : le contenu de la vue active seulement.
 */
import { motion, useReducedMotion } from "motion/react";
import { Tabs as TabsPrimitive } from "radix-ui";
import { type ReactNode, useId } from "react";
import { cn } from "../../lib/utils";

export interface ViewChoice<V extends string> {
  readonly value: V;
  readonly label: string;
  readonly icon?: ReactNode;
}

export interface ViewSwitcherProps<V extends string> {
  readonly label: string;
  readonly value: V;
  readonly views: readonly ViewChoice<V>[];
  readonly onValueChange: (value: V) => void;
  readonly actions?: ReactNode;
  readonly pending?: boolean | undefined;
  readonly hideLabels?: boolean | undefined;
  readonly children: ReactNode;
  readonly className?: string | undefined;
}

export function ViewSwitcher<V extends string>({
  label,
  value,
  views,
  onValueChange,
  actions,
  pending = false,
  hideLabels = false,
  children,
  className,
}: ViewSwitcherProps<V>) {
  const glide = useId();
  const still = useReducedMotion() ?? false;
  return (
    <TabsPrimitive.Root
      value={value}
      onValueChange={(next) => {
        const view = views.find((v) => v.value === next);
        if (view && view.value !== value) onValueChange(view.value);
      }}
      className={cn("grid min-w-0 gap-4", className)}
      data-slot="view-switcher"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsPrimitive.List
          aria-label={label}
          className="inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-menu border border-border bg-muted p-[3px]"
        >
          {views.map((view) => {
            const active = view.value === value;
            return (
              <TabsPrimitive.Trigger
                key={view.value}
                value={view.value}
                aria-label={hideLabels ? view.label : undefined}
                className={cn(
                  "relative inline-flex h-8 items-center gap-1.5 rounded-control px-3 text-[13px] font-medium whitespace-nowrap outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {active ? (
                  <motion.span
                    layoutId={glide}
                    aria-hidden
                    className="absolute inset-0 rounded-control bg-card shadow-xs dark:ring-1 dark:ring-border"
                    transition={
                      still
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 520, damping: 42 }
                    }
                  />
                ) : null}
                {view.icon ? (
                  <span aria-hidden className="relative flex [&_svg]:size-4">
                    {view.icon}
                  </span>
                ) : null}
                <span
                  className={cn("relative", hideLabels && "max-sm:sr-only")}
                >
                  {view.label}
                </span>
              </TabsPrimitive.Trigger>
            );
          })}
        </TabsPrimitive.List>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
      <TabsPrimitive.Content
        value={value}
        aria-busy={pending || undefined}
        className={cn(
          "min-w-0 outline-none transition-opacity duration-200 motion-reduce:transition-none",
          pending && "opacity-60",
        )}
      >
        {children}
      </TabsPrimitive.Content>
    </TabsPrimitive.Root>
  );
}
