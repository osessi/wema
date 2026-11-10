"use client";

import { CheckIcon } from "@phosphor-icons/react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { type KeyboardEvent, type ReactNode, useRef } from "react";
import { cn } from "../../lib/utils";
import { GlowTile, type GlowTone } from "../brand/glow-tile";

/**
 * Choix en cartes : à préférer à une liste déroulante sous 7 options.
 * Chaque carte porte une icône Phosphor dans une `GlowTile`, un titre et une
 * description ; l'état coché se voit (coque jaune, coche, liseré).
 *
 * - `type="single"` : `radiogroup` et `radio` (Radix : flèches, Tab, Espace),
 *   valeur envoyée avec le formulaire sous `name`.
 * - `type="multiple"` : `group` de cases `checkbox` (Espace ou clic), flèches
 *   pour passer d'une carte à l'autre, une valeur cachée par case cochée.
 */

export interface ChoiceOption {
  readonly value: string;
  readonly title: ReactNode;
  readonly description?: ReactNode;
  /** Glyphe Phosphor (élément), posé dans une `GlowTile`. */
  readonly icon?: ReactNode;
  readonly tone?: GlowTone | undefined;
  /** Pastille déjà faite (une `SubjectIcon`, par exemple), à la place de `icon`. */
  readonly media?: ReactNode;
  readonly disabled?: boolean | undefined;
}

interface ChoiceCardsBase {
  readonly options: readonly ChoiceOption[];
  /** Nom du champ dans le formulaire. */
  readonly name?: string | undefined;
  /** Nom accessible du groupe (ou `aria-labelledby`). */
  readonly "aria-label"?: string | undefined;
  readonly "aria-labelledby"?: string | undefined;
  /** Colonnes au-delà de 640 px (une seule en dessous). */
  readonly columns?: 1 | 2 | 3 | 4 | undefined;
  /** `compact` : icône 32 px, sans description sur la même ligne. */
  readonly size?: "default" | "compact" | undefined;
  readonly disabled?: boolean | undefined;
  readonly required?: boolean | undefined;
  readonly className?: string | undefined;
}

export interface ChoiceCardsSingleProps extends ChoiceCardsBase {
  readonly type?: "single" | undefined;
  readonly value?: string | undefined;
  readonly defaultValue?: string | undefined;
  readonly onValueChange?: ((value: string) => void) | undefined;
}

export interface ChoiceCardsMultipleProps extends ChoiceCardsBase {
  readonly type: "multiple";
  readonly value: readonly string[];
  readonly onValueChange: (value: string[]) => void;
}

export type ChoiceCardsProps =
  | ChoiceCardsSingleProps
  | ChoiceCardsMultipleProps;

const COLUMNS = {
  1: "",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
} as const;

/* Coque de la carte : papier au repos, jaune quand elle est cochée. */
const SHELL =
  "group/choice relative flex w-full min-w-0 rounded-[16px] border border-foreground/[0.09] bg-linear-to-b from-[color-mix(in_srgb,var(--foreground)_2%,var(--background))] to-[color-mix(in_srgb,var(--foreground)_4.5%,var(--background))] p-[5px] text-left outline-none " +
  "transition-[transform,border-color,background-color,box-shadow] duration-200 ease-out motion-reduce:transition-none " +
  "hover:-translate-y-0.5 hover:border-foreground/20 motion-reduce:hover:translate-y-0 " +
  "focus-visible:ring-[3px] focus-visible:ring-brand/50 " +
  "data-[state=checked]:border-[color-mix(in_srgb,var(--brand)_55%,var(--background))] data-[state=checked]:from-[color-mix(in_srgb,var(--brand)_14%,var(--background))] data-[state=checked]:to-[color-mix(in_srgb,var(--brand)_24%,var(--background))] data-[state=checked]:shadow-[0_10px_24px_-18px_rgb(184_135_0/0.7)] " +
  "dark:data-[state=checked]:border-[color-mix(in_srgb,var(--brand)_40%,var(--background))] dark:data-[state=checked]:from-[color-mix(in_srgb,var(--brand)_8%,var(--background))] dark:data-[state=checked]:to-[color-mix(in_srgb,var(--brand)_14%,var(--background))] " +
  "disabled:pointer-events-none disabled:opacity-50";

const INNER =
  "flex w-full min-w-0 items-start gap-3 rounded-[11px] border border-border bg-card p-3 shadow-[0_1px_2px_rgb(23_23_20/0.05)] transition-colors duration-200 motion-reduce:transition-none group-data-[state=checked]/choice:border-[color-mix(in_srgb,var(--brand)_60%,var(--card))] dark:shadow-none";

function ChoiceBody({
  option,
  size,
}: {
  option: ChoiceOption;
  size: "default" | "compact";
}) {
  return (
    <span className={INNER}>
      {option.media ? (
        <span className="shrink-0 transition-transform duration-200 group-hover/choice:scale-105 motion-reduce:transition-none motion-reduce:group-hover/choice:scale-100">
          {option.media}
        </span>
      ) : option.icon ? (
        <GlowTile
          tone={option.tone ?? "yellow"}
          size={size === "compact" ? 32 : 40}
          className="transition-transform duration-200 group-hover/choice:scale-105 motion-reduce:transition-none motion-reduce:group-hover/choice:scale-100"
        >
          {option.icon}
        </GlowTile>
      ) : null}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 pt-0.5">
        <span className="text-sm leading-snug font-semibold tracking-tight text-foreground">
          {option.title}
        </span>
        {option.description ? (
          <span className="text-[13px] leading-snug text-pretty text-muted-foreground">
            {option.description}
          </span>
        ) : null}
      </span>
      <span
        aria-hidden="true"
        className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-input bg-card text-ink-on-brand transition-colors duration-150 group-data-[state=checked]/choice:border-brand-active group-data-[state=checked]/choice:bg-brand motion-reduce:transition-none"
      >
        <CheckIcon
          weight="bold"
          className="size-3 scale-50 opacity-0 transition-[opacity,transform] duration-150 group-data-[state=checked]/choice:scale-100 group-data-[state=checked]/choice:opacity-100 motion-reduce:transition-none"
        />
      </span>
    </span>
  );
}

export function ChoiceCards(props: ChoiceCardsProps) {
  const {
    options,
    name,
    columns = 2,
    size = "default",
    disabled,
    required,
    className,
  } = props;
  const gridClass = cn("grid grid-cols-1 gap-2.5", COLUMNS[columns], className);
  const labelProps = {
    "aria-label": props["aria-label"],
    "aria-labelledby": props["aria-labelledby"],
  };

  if (props.type === "multiple") {
    return (
      <MultipleChoice
        {...props}
        gridClass={gridClass}
        size={size}
        labelProps={labelProps}
      />
    );
  }

  return (
    <RadioGroupPrimitive.Root
      data-slot="choice-cards"
      className={gridClass}
      value={props.value}
      defaultValue={props.defaultValue}
      onValueChange={props.onValueChange}
      name={name}
      disabled={disabled}
      required={required}
      {...labelProps}
    >
      {options.map((option) => (
        <RadioGroupPrimitive.Item
          key={option.value}
          value={option.value}
          disabled={option.disabled}
          data-slot="choice-card"
          className={SHELL}
        >
          <ChoiceBody option={option} size={size} />
        </RadioGroupPrimitive.Item>
      ))}
    </RadioGroupPrimitive.Root>
  );
}

function MultipleChoice({
  options,
  name,
  value,
  onValueChange,
  disabled,
  gridClass,
  size,
  labelProps,
}: ChoiceCardsMultipleProps & {
  gridClass: string;
  size: "default" | "compact";
  labelProps: Record<string, string | undefined>;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const toggle = (v: string) =>
    onValueChange(
      value.includes(v) ? value.filter((x) => x !== v) : [...value, v],
    );
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step =
      e.key === "ArrowDown" || e.key === "ArrowRight"
        ? 1
        : e.key === "ArrowUp" || e.key === "ArrowLeft"
          ? -1
          : 0;
    if (step === 0) return;
    e.preventDefault();
    for (let i = 1; i <= options.length; i++) {
      const next = (index + step * i + options.length) % options.length;
      const el = refs.current[next];
      if (el && !el.disabled) {
        el.focus();
        return;
      }
    }
  };
  return (
    // biome-ignore lint/a11y/useSemanticElements: groupe de cases en cartes, un fieldset imposerait une légende visible.
    <div
      role="group"
      data-slot="choice-cards"
      className={gridClass}
      {...labelProps}
    >
      {options.map((option, index) => {
        const checked = value.includes(option.value);
        return (
          // biome-ignore lint/a11y/useSemanticElements: case en carte (titre, description, pastille), une case native ne peut pas porter ce contenu.
          <button
            key={option.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="checkbox"
            aria-checked={checked}
            data-state={checked ? "checked" : "unchecked"}
            data-slot="choice-card"
            disabled={disabled || option.disabled}
            onClick={() => toggle(option.value)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={SHELL}
          >
            <ChoiceBody option={option} size={size} />
            {checked && name ? (
              <input type="hidden" name={name} value={option.value} />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
