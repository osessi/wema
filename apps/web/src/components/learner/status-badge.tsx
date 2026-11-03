import { cn } from "@wema/ui/lib/utils";
import { useTranslations } from "next-intl";
import type { NotionStatus } from "../../lib/learner-types";

/** Couleurs des statuts de notion, selon la charte. */
export const STATUS_CLASSES: Record<NotionStatus, string> = {
  not_seen: "bg-muted text-muted-foreground",
  needs_work: "bg-peach text-peach-ink",
  in_progress: "bg-butter text-butter-ink",
  mastered: "bg-primary text-primary-foreground",
};

/** Pastille de statut d'une notion (Non vue, À travailler, En cours, Validé). */
export function StatusBadge({
  status,
  className,
}: {
  status: NotionStatus;
  className?: string;
}) {
  const t = useTranslations("learner.status");
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        STATUS_CLASSES[status],
        className,
      )}
    >
      {t(status)}
    </span>
  );
}
