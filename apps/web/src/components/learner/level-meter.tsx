import { cn } from "@wema/ui/lib/utils";

/** Niveau d'un exercice en trois barres croissantes, avec son libellé lu. */
export function LevelMeter({
  level,
  label,
  max = 3,
}: {
  level: number;
  label: string;
  max?: number;
}) {
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="inline-flex h-[22px] items-end gap-0.5 rounded-full border bg-card px-2 pb-[5px]"
    >
      {Array.from({ length: Math.max(max, level) }, (_, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: barres fixes
          key={i}
          aria-hidden
          className={cn(
            "w-1 rounded-full",
            i < level ? "bg-brand" : "bg-muted-foreground/25",
          )}
          style={{ height: 5 + i * 3 }}
        />
      ))}
    </span>
  );
}
