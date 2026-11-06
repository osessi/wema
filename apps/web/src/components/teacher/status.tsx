import { Badge } from "@wema/ui/components/ui/badge";
import { cn } from "@wema/ui/lib/utils";
import { useTranslations } from "next-intl";
import type { NotionStatus } from "../../lib/teacher-types";

/** Couleurs de la charte pour les statuts d'une notion. */
export const STATUS_CLASSES: Record<NotionStatus, string> = {
  not_seen: "bg-muted text-muted-foreground",
  needs_work: "bg-peach text-peach-ink",
  in_progress: "bg-butter text-butter-ink",
  mastered: "bg-primary text-primary-foreground",
};

export function StatusBadge({
  status,
  className,
}: {
  status: NotionStatus;
  className?: string;
}) {
  const t = useTranslations("teacher.status");
  return (
    <Badge className={cn(STATUS_CLASSES[status], className)}>{t(status)}</Badge>
  );
}

/** Légende des statuts. */
export function StatusLegend() {
  const t = useTranslations("teacher.status");
  const statuses: NotionStatus[] = [
    "not_seen",
    "needs_work",
    "in_progress",
    "mastered",
  ];
  return (
    <ul className="flex flex-wrap gap-3 text-xs text-muted-foreground">
      {statuses.map((s) => (
        <li key={s} className="flex items-center gap-1.5">
          <span className={cn("size-3 rounded-full", STATUS_CLASSES[s])} />
          {t(s)}
        </li>
      ))}
    </ul>
  );
}

export type ExerciseStatus = "draft" | "validated" | "archived";

export function ExerciseStatusBadge({ status }: { status: ExerciseStatus }) {
  const t = useTranslations("teacher.exerciseStatus");
  const classes: Record<ExerciseStatus, string> = {
    draft: "bg-muted text-muted-foreground",
    validated: "bg-primary text-primary-foreground",
    archived: "border-border bg-transparent text-muted-foreground",
  };
  return <Badge className={classes[status]}>{t(status)}</Badge>;
}
