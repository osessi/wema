import { cn } from "@wema/ui/lib/utils";
import { useTranslations } from "next-intl";

export type ChipStatus = "not_seen" | "needs_work" | "in_progress" | "mastered";

const TONE: Record<ChipStatus, string> = {
  not_seen: "bg-muted text-muted-foreground",
  needs_work: "bg-peach text-peach-ink",
  in_progress: "bg-butter text-butter-ink",
  mastered: "bg-primary text-primary-foreground",
};

/** Statut d'une notion, aux couleurs de la charte. */
export function StatusChip({
  status,
  children,
  className,
}: {
  status: ChipStatus;
  children?: React.ReactNode;
  className?: string;
}) {
  const t = useTranslations("guardian.status");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        TONE[status],
        className,
      )}
    >
      {children ?? t(status)}
    </span>
  );
}
