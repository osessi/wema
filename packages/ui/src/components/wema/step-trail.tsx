import { Check } from "@phosphor-icons/react/dist/ssr";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../../lib/utils";

export type StepState = "done" | "current" | "upcoming";

export interface TrailStep {
  id: string;
  label: ReactNode;
  description?: ReactNode | undefined;
  state: StepState;
  /** Rend l'étape cliquable (lien ou bouton fourni par l'appelant). */
  render?: ((content: ReactNode) => ReactNode) | undefined;
}

export interface StepTrailProps extends Omit<ComponentProps<"ol">, "children"> {
  steps: TrailStep[];
  /** Nom accessible de la liste (« Étapes de l'inscription »). */
  label: string;
  /**
   * `horizontal` passe en vertical sous 640 px pour ne jamais déborder.
   * `vertical` reste vertical (« Mon chemin »).
   */
  orientation?: "horizontal" | "vertical" | undefined;
  /** Texte lu par les lecteurs d'écran pour l'état d'une étape. */
  stateLabels?: Partial<Record<StepState, string>> | undefined;
}

const DEFAULT_STATE_LABELS: Record<StepState, string> = {
  done: "terminée",
  current: "étape en cours",
  upcoming: "à venir",
};

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Étapes d'un parcours (onboarding, « Mon chemin ») : numéros mono `01 02 03`
 * comme sur les pages d'authentification, coche pour une étape terminée,
 * jaune pour l'étape en cours (`aria-current="step"`).
 */
export function StepTrail({
  steps,
  label,
  orientation = "horizontal",
  stateLabels,
  className,
  ...props
}: StepTrailProps) {
  const horizontal = orientation === "horizontal";
  const states = { ...DEFAULT_STATE_LABELS, ...stateLabels };
  return (
    <ol
      aria-label={label}
      data-slot="step-trail"
      data-orientation={orientation}
      className={cn(
        "flex flex-col gap-0",
        horizontal && "sm:flex-row sm:items-start sm:gap-2",
        className,
      )}
      {...props}
    >
      {steps.map((step, i) => {
        const last = i === steps.length - 1;
        const content = (
          <span className="flex min-w-0 gap-3">
            <span className="flex flex-col items-center">
              <span
                aria-hidden
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-full border font-mono text-xs font-medium tabular-nums transition-colors",
                  step.state === "done" &&
                    "border-transparent bg-foreground text-background",
                  step.state === "current" &&
                    "border-transparent bg-brand text-ink-on-brand ring-4 ring-brand/25",
                  step.state === "upcoming" &&
                    "border-border bg-card text-muted-foreground",
                )}
              >
                {step.state === "done" ? (
                  <Check weight="bold" className="size-3.5" />
                ) : (
                  pad(i + 1)
                )}
              </span>
              {!last ? (
                <span
                  aria-hidden
                  className={cn(
                    "my-1 min-h-4 w-px flex-1",
                    horizontal && "sm:hidden",
                    step.state === "done" ? "bg-foreground/40" : "bg-border",
                  )}
                />
              ) : null}
            </span>
            <span className={cn("min-w-0 pt-1", !last && "pb-4 sm:pb-0")}>
              <span
                className={cn(
                  "block text-sm font-medium",
                  step.state === "upcoming" && "text-muted-foreground",
                )}
              >
                {step.label}
                <span className="sr-only">, {states[step.state]}</span>
              </span>
              {step.description ? (
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {step.description}
                </span>
              ) : null}
            </span>
          </span>
        );
        return (
          <li
            key={step.id}
            aria-current={step.state === "current" ? "step" : undefined}
            className={cn(
              "flex min-w-0",
              horizontal && "sm:flex-1 sm:flex-col sm:gap-2",
            )}
          >
            {horizontal ? (
              <span
                aria-hidden
                className={cn(
                  "hidden h-0.5 w-full rounded-full sm:block",
                  step.state === "upcoming" && "bg-border",
                  step.state === "current" && "bg-brand",
                  step.state === "done" && "bg-foreground/50",
                )}
              />
            ) : null}
            {step.render ? step.render(content) : content}
          </li>
        );
      })}
    </ol>
  );
}
