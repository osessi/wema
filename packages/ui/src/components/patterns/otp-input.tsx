"use client";

/**
 * Saisie d'un code de connexion, une case par caractère.
 *
 * Source : ZeroAds `packages/ui/src/patterns/otp-input.tsx` (code d'Olivier), lui-même
 * tiré de shadcn-dashboard `input-otp-09` et de `input-otp` (MIT, guilhermerodz).
 * Ici sans la dépendance `input-otp` : un seul vrai `<input>` transparent posé sur les
 * cases (collage, saisie automatique du SMS `one-time-code`, lecteurs d'écran : un
 * seul champ). Le caractère tapé apparaît avec un petit ressort, le cadre actif glisse
 * de case en case, le curseur clignote. Immobile si l'utilisateur réduit les animations.
 *
 * Props :
 * - `value`, `onValueChange(value)`, `onComplete(value)` (code complet).
 * - `length` (6), `group` (3 : un tiret après chaque groupe de 3).
 * - `mode` : `numeric` (chiffres) ou `alphanumeric` (lettres et chiffres, mis en minuscules,
 *   comme les codes élèves de `@wema/access`).
 * - `label` : nom accessible du champ (obligatoire), `invalid`, `disabled`, `autoFocus`, `name`, `id`.
 */
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useReducedMotion,
} from "motion/react";
import { useId, useState } from "react";
import { cn } from "../../lib/utils";
import { springPop } from "../brand/motion";

export interface OtpInputProps {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly onComplete?: ((value: string) => void) | undefined;
  readonly label: string;
  readonly length?: number | undefined;
  readonly group?: number | undefined;
  readonly mode?: "numeric" | "alphanumeric" | undefined;
  readonly invalid?: boolean | undefined;
  readonly disabled?: boolean | undefined;
  readonly autoFocus?: boolean | undefined;
  readonly name?: string | undefined;
  readonly id?: string | undefined;
  readonly className?: string | undefined;
}

export function sanitizeOtp(
  raw: string,
  mode: "numeric" | "alphanumeric",
  length: number,
): string {
  const cleaned =
    mode === "numeric"
      ? raw.replace(/\D/g, "")
      : raw.toLowerCase().replace(/[^a-z0-9]/g, "");
  return cleaned.slice(0, length);
}

export function OtpInput({
  value,
  onValueChange,
  onComplete,
  label,
  length = 6,
  group = 3,
  mode = "numeric",
  invalid = false,
  disabled = false,
  autoFocus,
  name,
  id,
  className,
}: OtpInputProps) {
  const layout = useId();
  const still = useReducedMotion() ?? false;
  const [focused, setFocused] = useState(false);
  const active = Math.min(value.length, length - 1);

  const groups: number[][] = [];
  for (let i = 0; i < length; i += group) {
    groups.push(
      Array.from({ length: Math.min(group, length - i) }, (_, k) => i + k),
    );
  }

  return (
    <LayoutGroup id={layout}>
      <div
        className={cn(
          "relative inline-flex items-center gap-2 sm:gap-3",
          disabled && "opacity-50",
          className,
        )}
        data-slot="otp-input"
      >
        <input
          id={id}
          name={name}
          aria-label={label}
          aria-invalid={invalid || undefined}
          value={value}
          disabled={disabled}
          // biome-ignore lint/a11y/noAutofocus: choix explicite de l'appelant (écran de code)
          autoFocus={autoFocus}
          autoComplete="one-time-code"
          inputMode={mode === "numeric" ? "numeric" : "text"}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={length}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(event) => {
            const next = sanitizeOtp(event.target.value, mode, length);
            onValueChange(next);
            if (next.length === length && onComplete) onComplete(next);
          }}
          // Le caret reste au bout : on efface et on tape toujours en fin de code.
          onSelect={(event) => {
            const el = event.currentTarget;
            el.setSelectionRange(el.value.length, el.value.length);
          }}
          className="absolute inset-0 z-10 h-full w-full cursor-text bg-transparent text-transparent caret-transparent opacity-0 outline-none disabled:cursor-not-allowed"
        />
        {groups.map((indexes, g) => (
          <div
            key={indexes[0]}
            className="flex items-center gap-1 sm:gap-1.5"
            aria-hidden
          >
            {g > 0 ? (
              <span className="me-1 h-px w-2 bg-line-strong sm:me-1.5" />
            ) : null}
            {indexes.map((index) => {
              const char = value[index] ?? null;
              const isActive = focused && index === active;
              const caret = isActive && char === null;
              return (
                <div
                  key={index}
                  className={cn(
                    "relative grid h-11 w-8 place-items-center sm:h-12 sm:w-10 rounded-control border bg-card text-foreground shadow-xs transition-colors duration-150",
                    invalid ? "border-destructive/60" : "border-input",
                    char !== null && !invalid && "border-line-strong",
                  )}
                >
                  <AnimatePresence mode="popLayout" initial={false}>
                    {char === null ? null : (
                      <motion.span
                        key={char + index}
                        initial={
                          still ? false : { opacity: 0, scale: 0.6, y: 3 }
                        }
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={
                          still
                            ? { opacity: 0 }
                            : {
                                opacity: 0,
                                scale: 0.7,
                                y: -3,
                                transition: { duration: 0.1 },
                              }
                        }
                        transition={springPop}
                        className="absolute font-mono text-lg font-semibold tabular-nums"
                      >
                        {char}
                      </motion.span>
                    )}
                  </AnimatePresence>
                  {isActive ? (
                    <motion.span
                      layoutId="otp-active"
                      className={cn(
                        "pointer-events-none absolute -inset-px rounded-control border ring-[3px]",
                        invalid
                          ? "border-destructive ring-destructive/20"
                          : "border-foreground ring-brand/45",
                      )}
                      transition={
                        still
                          ? { duration: 0 }
                          : {
                              type: "spring",
                              stiffness: 640,
                              damping: 42,
                              mass: 0.6,
                            }
                      }
                    />
                  ) : null}
                  {caret ? (
                    <motion.span
                      className="pointer-events-none absolute h-5 w-px bg-foreground"
                      animate={
                        still ? { opacity: 1 } : { opacity: [1, 1, 0, 0] }
                      }
                      transition={{
                        duration: 1,
                        repeat: Number.POSITIVE_INFINITY,
                        times: [0, 0.5, 0.5, 1],
                      }}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </LayoutGroup>
  );
}
