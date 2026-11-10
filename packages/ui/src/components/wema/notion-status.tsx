import {
  ArrowCounterClockwise,
  Check,
  CircleHalf,
} from "@phosphor-icons/react/dist/ssr";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../../lib/utils";

/**
 * Statuts d'une notion, dans l'ordre de progression. Ce sont les clés que
 * renvoie l'API (`learner`, `guardian`, `teacher`, `school`).
 */
export const NOTION_STATUSES = [
  "not_seen",
  "needs_work",
  "in_progress",
  "mastered",
] as const;

export type NotionStatusKey = (typeof NOTION_STATUSES)[number];

/** Libellés par défaut, repris des fichiers de traduction de l'application. */
export const NOTION_STATUS_LABELS: Record<NotionStatusKey, string> = {
  not_seen: "Non vue",
  needs_work: "À travailler",
  in_progress: "En cours",
  mastered: "Validé",
};

/**
 * Tons de la charte, uniques pour toute l'application. « Validé » est vert
 * menthe dans les deux thèmes (il n'emprunte plus `--primary`, noir en clair
 * et jaune en sombre).
 */
export const NOTION_STATUS_TONES: Record<
  NotionStatusKey,
  { chip: string; dot: string; cell: string; glyph: string }
> = {
  not_seen: {
    glyph: "",
    chip: "bg-status-not-seen text-status-not-seen-ink",
    dot: "bg-status-not-seen-ink/60",
    cell: "bg-status-not-seen",
  },
  needs_work: {
    glyph: "text-status-needs-work-ink",
    chip: "bg-status-needs-work text-status-needs-work-ink",
    dot: "bg-status-needs-work-ink",
    cell: "bg-status-needs-work",
  },
  in_progress: {
    glyph: "text-status-in-progress-ink",
    chip: "bg-status-in-progress text-status-in-progress-ink",
    dot: "bg-status-in-progress-ink",
    cell: "bg-status-in-progress",
  },
  mastered: {
    glyph: "text-status-mastered-ink",
    chip: "bg-status-mastered text-status-mastered-ink",
    dot: "bg-status-mastered-ink",
    cell: "bg-status-mastered",
  },
};

/** Un signe par statut, pour que la couleur ne soit jamais le seul codage. */
export const NOTION_STATUS_GLYPHS: Record<NotionStatusKey, ReactNode> = {
  not_seen: null,
  needs_work: <ArrowCounterClockwise weight="bold" className="size-3.5" />,
  in_progress: <CircleHalf weight="fill" className="size-3.5" />,
  mastered: <Check weight="bold" className="size-3.5" />,
};

export function isNotionStatus(value: unknown): value is NotionStatusKey {
  return NOTION_STATUSES.some((s) => s === value);
}

export interface NotionStatusProps
  extends Omit<ComponentProps<"span">, "children"> {
  status: NotionStatusKey;
  /** Libellé affiché (traduction de l'espace). Par défaut, le libellé français. */
  label?: string | undefined;
  /** `sm` pour les tableaux denses. */
  size?: "sm" | "md" | undefined;
}

/**
 * Pastille de statut d'une notion : un point et un libellé, pour que la
 * couleur ne soit jamais le seul codage. Remplace `StatusBadge` (élève, prof),
 * `StatusChip` (parent) et le `TONE` de la carte de l'école.
 */
export function NotionStatus({
  status,
  label,
  size = "md",
  className,
  ...props
}: NotionStatusProps) {
  const tone = NOTION_STATUS_TONES[status];
  return (
    <span
      data-slot="notion-status"
      data-status={status}
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full font-medium whitespace-nowrap",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-0.5 text-xs",
        tone.chip,
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn("size-1.5 shrink-0 rounded-full", tone.dot)}
      />
      {label ?? NOTION_STATUS_LABELS[status]}
    </span>
  );
}

export interface NotionStatusLegendProps extends ComponentProps<"ul"> {
  /** Libellés des statuts (traduction de l'espace). */
  labels?: Partial<Record<NotionStatusKey, string>> | undefined;
}

/** Légende des statuts : une case colorée et son libellé. */
export function NotionStatusLegend({
  labels,
  className,
  ...props
}: NotionStatusLegendProps) {
  return (
    <ul
      className={cn(
        "flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground",
        className,
      )}
      {...props}
    >
      {NOTION_STATUSES.map((s) => (
        <li key={s} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={cn(
              "grid size-5 place-items-center rounded-chip border border-foreground/10 [&_svg]:size-3",
              NOTION_STATUS_TONES[s].cell,
              NOTION_STATUS_TONES[s].glyph,
            )}
          >
            {NOTION_STATUS_GLYPHS[s]}
          </span>
          {labels?.[s] ?? NOTION_STATUS_LABELS[s]}
        </li>
      ))}
    </ul>
  );
}
