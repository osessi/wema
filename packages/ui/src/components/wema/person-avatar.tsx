import type { ComponentProps, ReactNode } from "react";
import { cn } from "../../lib/utils";

/**
 * Une couleur par personne, stable : la teinte dérive de l'identifiant (ou du
 * nom à défaut), jamais du rang dans une liste. Huit tons pastel lisibles dans
 * les deux thèmes (fond pastel, encre foncée en clair et claire en sombre).
 */
export const PERSON_TONES = [
  "mint",
  "butter",
  "peach",
  "rose",
  "lime",
  "sand",
  "sky",
  "slate",
] as const;
export type PersonTone = (typeof PERSON_TONES)[number];

const TONE_CLASS: Record<PersonTone, string> = {
  mint: "bg-mint text-mint-ink",
  butter: "bg-butter text-butter-ink",
  peach: "bg-peach text-peach-ink",
  rose: "bg-rose text-rose-ink",
  lime: "bg-lime text-lime-ink",
  sand: "bg-sand text-sand-ink",
  sky: "bg-[#cdeeff] text-[#0b4766] dark:bg-[#0f2a38] dark:text-[#a5e3ff]",
  slate: "bg-info-soft text-info-text",
};

/** Ton stable d'une personne (FNV-1a 32 bits, puis brassage final de Murmur3). */
export function personTone(seed: string): PersonTone {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return PERSON_TONES[(h >>> 0) % PERSON_TONES.length] ?? "slate";
}

/** Initiales (deux au plus) : « Awa Diallo » → « AD », « awa » → « A ». */
export function initialsOf(name: string): string {
  const words = name
    .trim()
    .split(/[\s\-_.@]+/)
    .filter((w) => w.length > 0);
  const first = words[0]?.[0] ?? "?";
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? "") : "";
  return `${first}${last}`.toLocaleUpperCase("fr-FR");
}

const SIZE_CLASS = {
  xs: "size-5 text-[9px]",
  sm: "size-6 text-[10px]",
  default: "size-8 text-xs",
  lg: "size-10 text-sm",
  xl: "size-12 text-base",
} as const;
export type PersonAvatarSize = keyof typeof SIZE_CLASS;

export interface PersonAvatarProps
  extends Omit<ComponentProps<"span">, "children"> {
  /** Nom affiché (sert aux initiales et au nom accessible). */
  readonly name: string;
  /** Identifiant stable : la couleur en dérive. À défaut, le nom. */
  readonly seed?: string | undefined;
  readonly size?: PersonAvatarSize | undefined;
  /** Force un ton (sinon dérivé de `seed`). */
  readonly tone?: PersonTone | undefined;
  /** Le nom est déjà écrit à côté : l'avatar est masqué aux lecteurs d'écran. */
  readonly decorative?: boolean | undefined;
}

/** Avatar à initiales, coloré de façon déterministe. */
export function PersonAvatar({
  name,
  seed,
  size = "default",
  tone,
  decorative = false,
  className,
  ...props
}: PersonAvatarProps) {
  const t = tone ?? personTone(seed ?? name);
  return (
    <span
      data-slot="person-avatar"
      data-tone={t}
      {...(decorative
        ? { "aria-hidden": true }
        : { role: "img", "aria-label": name })}
      title={decorative ? undefined : name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-mono font-semibold tracking-[0.02em] select-none",
        "shadow-[inset_0_0_0_1px_color-mix(in_srgb,currentColor_14%,transparent)]",
        SIZE_CLASS[size],
        TONE_CLASS[t],
        className,
      )}
      {...props}
    >
      {initialsOf(name)}
    </span>
  );
}

export interface PersonStackProps extends ComponentProps<"div"> {
  readonly people: readonly { readonly id: string; readonly name: string }[];
  /** Nombre d'avatars visibles avant « +N ». */
  readonly max?: number | undefined;
  readonly size?: PersonAvatarSize | undefined;
}

/** Avatars empilés, avec « +N » au-delà de `max`. */
export function PersonStack({
  people,
  max = 4,
  size = "sm",
  className,
  ...props
}: PersonStackProps) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <div
      data-slot="person-stack"
      className={cn("flex items-center -space-x-1.5", className)}
      {...props}
    >
      {shown.map((p) => (
        <PersonAvatar
          key={p.id}
          name={p.name}
          seed={p.id}
          size={size}
          className="ring-2 ring-card"
        />
      ))}
      {rest > 0 ? (
        <span
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-full bg-muted font-mono font-medium text-muted-foreground ring-2 ring-card",
            SIZE_CLASS[size],
          )}
        >
          +{rest}
        </span>
      ) : null}
    </div>
  );
}

export interface PersonChipProps extends ComponentProps<"span"> {
  readonly name: string;
  readonly seed?: string | undefined;
  /** Ligne secondaire (rôle, classe, courriel). */
  readonly meta?: ReactNode;
  readonly size?: "sm" | "default" | undefined;
}

/** Avatar et nom, pour les tableaux et les listes. */
export function PersonChip({
  name,
  seed,
  meta,
  size = "default",
  className,
  ...props
}: PersonChipProps) {
  return (
    <span
      data-slot="person-chip"
      className={cn("inline-flex min-w-0 items-center gap-2.5", className)}
      {...props}
    >
      <PersonAvatar
        name={name}
        seed={seed}
        size={size === "sm" ? "sm" : "default"}
        decorative
      />
      <span className="flex min-w-0 flex-col leading-tight">
        <span
          className={cn(
            "truncate font-medium text-foreground",
            size === "sm" ? "text-[13px]" : "text-sm",
          )}
        >
          {name}
        </span>
        {meta ? (
          <span className="truncate text-xs text-muted-foreground">{meta}</span>
        ) : null}
      </span>
    </span>
  );
}
