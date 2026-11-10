"use client";

import {
  Archive,
  Books,
  Check,
  Clock,
  PencilSimple,
  Seal,
  Sparkle,
  UsersThree,
  X,
} from "@phosphor-icons/react";
import { Badge } from "@wema/ui/components/ui/badge";
import { NotionStatus } from "@wema/ui/components/wema/notion-status";
import { cn } from "@wema/ui/lib/utils";
import { useTranslations } from "next-intl";
import type { NotionStatus as NotionStatusKey } from "../../lib/teacher-types";

const ICON = "size-3";

/** Statut d'une notion, avec les libellés de l'espace prof. */
export function StatusBadge({
  status,
  size,
}: {
  status: NotionStatusKey;
  size?: "sm" | "md";
}) {
  const t = useTranslations("teacher.status");
  return <NotionStatus status={status} label={t(status)} size={size} />;
}

export type ExerciseStatus = "draft" | "validated" | "archived";

/** Statut d'un exercice : validé (vert, sceau), brouillon, archivé (barré). */
export function ExerciseStatusBadge({ status }: { status: ExerciseStatus }) {
  const t = useTranslations("teacher.exerciseStatus");
  if (status === "validated")
    return (
      <Badge variant="success">
        <Seal weight="fill" className={ICON} />
        {t(status)}
      </Badge>
    );
  if (status === "draft")
    return (
      <Badge variant="warning">
        <PencilSimple weight="bold" className={ICON} />
        {t(status)}
      </Badge>
    );
  return (
    <Badge variant="neutral" className="line-through decoration-1">
      <Archive weight="bold" className={ICON} />
      {t(status)}
    </Badge>
  );
}

export type ExerciseSource = "teacher" | "admin" | "ai" | "wema";

/** Origine d'un exercice : IA (jaune), équipe (bleu), Wema (vert). */
export function SourceBadge({
  source,
  className,
}: {
  source: ExerciseSource;
  className?: string;
}) {
  const t = useTranslations("teacher.library.source");
  if (source === "ai")
    return (
      <Badge variant="brand" className={className}>
        <Sparkle weight="fill" className={ICON} />
        {t(source)}
      </Badge>
    );
  if (source === "teacher")
    return (
      <Badge variant="info" className={className}>
        <UsersThree weight="bold" className={ICON} />
        {t(source)}
      </Badge>
    );
  return (
    <Badge variant="success" className={className}>
      <Books weight="bold" className={ICON} />
      {t(source)}
    </Badge>
  );
}

/** Type de tâche, en étiquette mono capitale. */
export function KindBadge({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <Badge
      variant="neutral"
      className={cn(
        "font-mono text-[10px] tracking-wider uppercase",
        className,
      )}
    >
      {label}
    </Badge>
  );
}

export type BankStatus = "proposed" | "selected" | "rejected";

/** Statut d'une entrée de la banque : à trier, retenu, écarté. */
export function BankStatusBadge({ status }: { status: BankStatus }) {
  const t = useTranslations("teacher.bank.status");
  if (status === "selected")
    return (
      <Badge variant="success">
        <Check weight="bold" className={ICON} />
        {t(status)}
      </Badge>
    );
  if (status === "proposed")
    return (
      <Badge variant="warning">
        <Clock weight="bold" className={ICON} />
        {t(status)}
      </Badge>
    );
  return (
    <Badge variant="neutral">
      <X weight="bold" className={ICON} />
      {t(status)}
    </Badge>
  );
}
