"use client";

/**
 * Assistant en étapes (onboarding du parent, de l'élève, du prof).
 *
 * Source : ZeroAds `apps/web/src/components/onboarding/{steps,stage-heading,stage-loading}.tsx`
 * (code d'Olivier), adapté à Wema : jaune de marque, numéros en Geist Mono,
 * textes en français au vouvoiement, contenu qui glisse dans le sens du parcours.
 * `StepTrail` (components/wema) reste la frise de parcours ; `Stepper` est
 * l'assistant complet : progression, en-tête, contenu, boutons, chargement.
 *
 * Props de `Stepper` :
 * - `steps` : `{ id, label }[]` ; `current` : index de l'étape affichée (0…n-1).
 * - `title`, `description` : en-tête de l'étape ; `eyebrow` remplace « Étape 2 sur 5 · Libellé ».
 * - `onBack`, `onNext` : boutons « Précédent » et « Suivant » (absents si non fournis ;
 *   « Précédent » est masqué à la première étape).
 * - `canNext` (vrai par défaut), `pending` (envoi en cours : bouton occupé),
 *   `nextLabel`, `backLabel`, `pendingLabel`, `finishLabel` (dernière étape).
 * - `loading` : `{ work: string[] }` affiche `StepLoading` à la place du contenu.
 * - `children` : le contenu de l'étape.
 * - `labels.progress(n, total)` : texte « Étape n sur total ».
 *
 * Pièces exportées pour un montage libre : `StepperProgress`, `StepHeading`,
 * `StepNav`, `StepLoading`.
 */
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  SealCheckIcon,
} from "@phosphor-icons/react";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useReducedMotion,
} from "motion/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";
import { ARRIVE, DUR, springPop } from "../brand/motion";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import { Spinner } from "../ui/spinner";

export interface StepperStep {
  readonly id: string;
  readonly label: string;
  /** État réel de l'étape ; sans lui, une étape avant la courante compte comme faite. */
  readonly done?: boolean | undefined;
}

const pad = (n: number) => String(n).padStart(2, "0");
const defaultProgress = (n: number, total: number) => `Étape ${n} sur ${total}`;

/* ---------------------------------------------------------------------------
 * Progression : bulles reliées par un trait qui se remplit (≥ 768 px),
 * segments sous le titre de l'étape (téléphone).
 * ------------------------------------------------------------------------- */

export interface StepperProgressProps {
  readonly steps: readonly StepperStep[];
  readonly current: number;
  /** Nom accessible (« Progression de l'inscription »). */
  readonly label?: string | undefined;
  readonly progressLabel?: ((n: number, total: number) => string) | undefined;
  readonly className?: string | undefined;
}

export function StepperProgress({
  steps,
  current,
  label = "Progression",
  progressLabel = defaultProgress,
  className,
}: StepperProgressProps) {
  const total = steps.length;
  const shown = steps[current];
  return (
    <MotionConfig reducedMotion="user">
      <nav
        aria-label={label}
        className={cn("w-full", className)}
        data-slot="stepper-progress"
      >
        <ol className="hidden items-start justify-center md:flex">
          {steps.map((step, i) => {
            const state =
              i === current
                ? "current"
                : (step.done ?? i < current)
                  ? "done"
                  : "upcoming";
            return (
              <li key={step.id} className="flex items-start">
                <div
                  aria-current={state === "current" ? "step" : undefined}
                  className="flex flex-col items-center gap-1.5 px-2"
                >
                  <motion.span
                    aria-hidden
                    initial={false}
                    animate={{ scale: state === "current" ? 1 : 0.92 }}
                    transition={{ duration: DUR.state, ease: ARRIVE }}
                    className={cn(
                      "grid size-8 place-items-center rounded-full border font-mono text-xs font-medium tabular-nums transition-colors duration-200",
                      state === "done" &&
                        "border-transparent bg-foreground text-background",
                      state === "current" &&
                        "border-transparent bg-brand text-ink-on-brand ring-4 ring-brand/25",
                      state === "upcoming" &&
                        "border-border bg-card text-muted-foreground",
                    )}
                  >
                    {state === "done" ? (
                      <CheckIcon weight="bold" className="size-3.5" />
                    ) : (
                      pad(i + 1)
                    )}
                  </motion.span>
                  <span
                    className={cn(
                      "text-xs whitespace-nowrap",
                      state === "upcoming"
                        ? "text-muted-foreground"
                        : "text-foreground",
                      state === "current" && "font-medium",
                    )}
                  >
                    {step.label}
                    <span className="sr-only">
                      {state === "done"
                        ? ", terminée"
                        : state === "current"
                          ? ", en cours"
                          : ", à venir"}
                    </span>
                  </span>
                </div>
                {i < total - 1 ? (
                  <span
                    aria-hidden
                    className="relative mt-4 h-0.5 w-8 overflow-hidden rounded-full bg-border lg:w-14"
                  >
                    <motion.span
                      className="absolute inset-0 origin-left bg-brand"
                      initial={false}
                      animate={{ scaleX: i < current ? 1 : 0 }}
                      transition={{ duration: DUR.slow, ease: ARRIVE }}
                    />
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>

        <div className="md:hidden">
          <p className="text-[13px] text-muted-foreground">
            <span className="font-medium text-foreground">{shown?.label}</span>
            <span className="font-mono tabular-nums">
              {" "}
              · {progressLabel(current + 1, total)}
            </span>
          </p>
          <ol
            aria-hidden
            className="mt-2 grid gap-1.5"
            style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
          >
            {steps.map((step, i) => (
              <li
                key={step.id}
                className="relative h-1.5 overflow-hidden rounded-full bg-border"
              >
                <motion.span
                  className={cn(
                    "absolute inset-0 origin-left rounded-full",
                    i === current ? "bg-brand" : "bg-foreground",
                  )}
                  initial={false}
                  animate={{ scaleX: i <= current ? 1 : 0 }}
                  transition={{ duration: DUR.base, ease: ARRIVE }}
                />
              </li>
            ))}
          </ol>
        </div>
      </nav>
    </MotionConfig>
  );
}

/* ---------------------------------------------------------------------------
 * En-tête d'étape : sur-titre mono, titre, une ligne d'explication.
 * ------------------------------------------------------------------------- */

export interface StepHeadingProps {
  /** Sur-titre mono : « Étape 2 sur 5 · Votre enfant ». */
  readonly eyebrow?: ReactNode;
  readonly title: ReactNode;
  readonly description?: ReactNode;
  /** Balise du titre (`h1` par défaut : l'étape est la page). */
  readonly as?: "h1" | "h2" | "p" | undefined;
  readonly className?: string | undefined;
}

export function StepHeading({
  eyebrow,
  title,
  description,
  as: Title = "h1",
  className,
}: StepHeadingProps) {
  return (
    <div className={className} data-slot="step-heading">
      {eyebrow ? (
        <p className="font-mono text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
          {eyebrow}
        </p>
      ) : null}
      <Title className="mt-2 text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-[28px]">
        {title}
      </Title>
      {description ? (
        <p className="mt-2 text-sm text-pretty text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Boutons précédent / suivant. L'action phare est jaune.
 * ------------------------------------------------------------------------- */

export interface StepNavProps {
  readonly onBack?: (() => void) | undefined;
  readonly onNext?: (() => void) | undefined;
  readonly canNext?: boolean | undefined;
  readonly pending?: boolean | undefined;
  readonly backLabel?: string | undefined;
  readonly nextLabel?: string | undefined;
  readonly pendingLabel?: string | undefined;
  /** `submit` : le bouton suivant soumet le formulaire englobant. */
  readonly nextType?: "button" | "submit" | undefined;
  readonly className?: string | undefined;
}

export function StepNav({
  onBack,
  onNext,
  canNext = true,
  pending = false,
  backLabel = "Précédent",
  nextLabel = "Suivant",
  pendingLabel = "Enregistrement…",
  nextType = "button",
  className,
}: StepNavProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap-reverse items-center justify-between gap-3",
        className,
      )}
      data-slot="step-nav"
    >
      {onBack ? (
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          disabled={pending}
        >
          <ArrowLeftIcon aria-hidden />
          {backLabel}
        </Button>
      ) : (
        <span />
      )}
      {onNext || nextType === "submit" ? (
        <Button
          type={nextType}
          variant="brand"
          onClick={onNext}
          disabled={!canNext || pending}
          aria-busy={pending || undefined}
          className="min-w-32"
        >
          {pending ? (
            <>
              <Spinner aria-label={pendingLabel} />
              {pendingLabel}
            </>
          ) : (
            <>
              {nextLabel}
              <ArrowRightIcon aria-hidden />
            </>
          )}
        </Button>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Chargement d'étape : ce que Wema prépare, ligne après ligne (la dernière
 * reste en cours jusqu'à l'arrivée de la page), puis la forme de la page.
 * ------------------------------------------------------------------------- */

const STEP_MS = 1300;

export interface StepLoadingProps {
  /** Ce que Wema fait pendant l'attente, dans l'ordre : « Lecture du programme… ». */
  readonly work: readonly string[];
  /** Lignes du squelette sous la liste. */
  readonly rows?: number | undefined;
  /** Nom accessible : « Préparation de l'étape ». */
  readonly label?: string | undefined;
  readonly className?: string | undefined;
}

export function StepLoading({
  work,
  rows = 3,
  label = "Préparation de l'étape",
  className,
}: StepLoadingProps) {
  const still = useReducedMotion() ?? false;
  const [index, setIndex] = useState(0);
  const last = work.length - 1;

  useEffect(() => {
    if (still || index >= last) return;
    const timer = setTimeout(() => setIndex(index + 1), STEP_MS);
    return () => clearTimeout(timer);
  }, [index, last, still]);

  const shown = still ? [work[last] ?? ""] : work.slice(0, index + 1);
  const at = still ? 0 : index;

  return (
    <output
      aria-label={label}
      className={cn("block", className)}
      data-slot="step-loading"
    >
      <ol className="grid gap-2.5" aria-live="polite">
        {shown.map((line, i) => (
          <motion.li
            key={line}
            initial={still ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DUR.slow, ease: ARRIVE }}
            className="flex items-center gap-3 text-sm"
          >
            <span className="grid size-6 shrink-0 place-items-center">
              {i < at ? (
                <motion.span
                  initial={{ scale: 0.3, opacity: 0, rotate: -30 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  transition={springPop}
                  className="flex text-success"
                >
                  <SealCheckIcon size={20} weight="fill" aria-hidden />
                </motion.span>
              ) : (
                <Spinner
                  aria-hidden
                  aria-label={undefined}
                  className="text-brand-text dark:text-brand"
                />
              )}
            </span>
            <span
              className={
                i < at ? "text-muted-foreground" : "font-medium text-foreground"
              }
            >
              {line}
            </span>
          </motion.li>
        ))}
      </ol>
      <div
        className="mt-6 grid gap-4 rounded-card border border-border bg-card p-6"
        aria-hidden
      >
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-5 w-72 max-w-full" />
        {Array.from({ length: rows }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: lignes de squelette positionnelles
          <div key={i} className="grid gap-2 sm:grid-cols-[150px_1fr]">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3.5 w-full max-w-[420px]" />
          </div>
        ))}
      </div>
    </output>
  );
}

/* ---------------------------------------------------------------------------
 * L'assistant complet.
 * ------------------------------------------------------------------------- */

export interface StepperProps {
  readonly steps: readonly StepperStep[];
  readonly current: number;
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly eyebrow?: ReactNode;
  readonly onBack?: (() => void) | undefined;
  readonly onNext?: (() => void) | undefined;
  readonly canNext?: boolean | undefined;
  readonly pending?: boolean | undefined;
  readonly backLabel?: string | undefined;
  readonly nextLabel?: string | undefined;
  readonly finishLabel?: string | undefined;
  readonly pendingLabel?: string | undefined;
  readonly loading?: { readonly work: readonly string[] } | undefined;
  readonly labels?: {
    readonly progress?: ((n: number, total: number) => string) | undefined;
    readonly nav?: string | undefined;
  };
  readonly children?: ReactNode;
  readonly className?: string | undefined;
}

export function Stepper({
  steps,
  current,
  title,
  description,
  eyebrow,
  onBack,
  onNext,
  canNext,
  pending,
  backLabel,
  nextLabel = "Suivant",
  finishLabel = "Terminer",
  pendingLabel,
  loading,
  labels,
  children,
  className,
}: StepperProps) {
  const reduce = useReducedMotion() ?? false;
  const previous = useRef(current);
  const direction = current >= previous.current ? 1 : -1;
  useEffect(() => {
    previous.current = current;
  }, [current]);
  const progress = labels?.progress ?? defaultProgress;
  const isLast = current === steps.length - 1;
  const step = steps[current];
  const offset = reduce ? 0 : 24 * direction;

  return (
    <div className={cn("grid gap-8", className)} data-slot="stepper">
      <StepperProgress
        steps={steps}
        current={current}
        label={labels?.nav}
        progressLabel={progress}
      />
      <AnimatePresence mode="wait" initial={false}>
        <motion.section
          key={step?.id ?? current}
          initial={{ opacity: 0, x: offset }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -offset }}
          transition={{ duration: reduce ? 0 : DUR.panel, ease: ARRIVE }}
          className="grid gap-6"
          aria-busy={loading ? true : undefined}
        >
          <StepHeading
            eyebrow={
              eyebrow ??
              `${progress(current + 1, steps.length)} · ${step?.label ?? ""}`
            }
            title={title}
            description={description}
          />
          {loading ? (
            <StepLoading work={loading.work} />
          ) : (
            <div>{children}</div>
          )}
        </motion.section>
      </AnimatePresence>
      <StepNav
        onBack={current > 0 ? onBack : undefined}
        onNext={onNext}
        canNext={canNext !== false && !loading}
        pending={pending}
        backLabel={backLabel}
        nextLabel={isLast ? finishLabel : nextLabel}
        pendingLabel={pendingLabel}
        className="border-t border-border pt-5"
      />
    </div>
  );
}
