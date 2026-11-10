import { cn } from "@wema/ui/lib/utils";

const TONES = {
  brand: "bg-brand",
  mint: "bg-status-mastered-ink",
} as const;

/** Petite barre de progression de tableau : valeur à gauche, jauge à droite. */
export function MiniBar({
  value,
  text,
  tone,
}: {
  /** Pourcentage de 0 à 100, ou null si inconnu. */
  value: number | null;
  text: string;
  tone: keyof typeof TONES;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-10 shrink-0 text-right tabular-nums">{text}</span>
      <span
        aria-hidden
        className="h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-muted"
      >
        {value !== null && (
          <span
            className={cn("block h-full rounded-full", TONES[tone])}
            style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
          />
        )}
      </span>
    </div>
  );
}
