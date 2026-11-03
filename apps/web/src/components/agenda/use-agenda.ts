"use client";

import { cn } from "@wema/ui/lib/utils";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { type MutationResult, mutate } from "../../lib/mutate";
import type { SessionStatus } from "./types";

const AGENDA_ERRORS = new Set([
  "forbidden",
  "not_found",
  "invalid_range",
  "invalid_time_zone",
  "in_past",
  "slot_unavailable",
  "teacher_busy",
  "learner_busy",
  "session_changed",
  "session_not_over",
  "invalid_notion",
  "empty_group",
  "network",
  "unauthenticated",
]);

/** Écriture de l'agenda : erreurs traduites par agenda.errors, page rafraîchie. */
export function useAgendaMutation() {
  const t = useTranslations("agenda.errors");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(
    method: "POST" | "DELETE",
    path: string,
    body?: unknown,
  ): Promise<MutationResult> {
    setPending(true);
    setError(null);
    const result = await mutate(method, `/agenda${path}`, body);
    setPending(false);
    if (!result.ok) {
      if (result.code === "unauthenticated") router.push("/connexion");
      setError(AGENDA_ERRORS.has(result.code) ? t(result.code) : t("generic"));
      if (result.code === "session_changed") router.refresh();
    } else {
      router.refresh();
    }
    return result;
  }

  return { run, pending, error, setError };
}

/** Vrai une fois dans le navigateur (l'agenda dépend du fuseau de l'appareil). */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

/**
 * Aspect d'une séance selon son statut. Pas de barre de couleur sur le bord :
 * la hiérarchie passe par la bordure (pleine, pointillée) et le fond.
 */
export function sessionTone(status: SessionStatus): string {
  return cn(
    "border text-foreground",
    status === "confirmed" && "border-foreground/25 bg-card",
    (status === "requested" || status === "proposed") &&
      "border-dashed border-foreground/40 bg-card",
    status === "done" && "border-transparent bg-muted text-muted-foreground",
    (status === "cancelled" || status === "declined") &&
      "border-transparent bg-muted/60 text-muted-foreground line-through",
  );
}

/** Libellé d'une séance : son titre, le groupe, ou la personne. */
export function useSessionLabel() {
  const t = useTranslations("agenda");
  return (
    s: {
      title: string | null;
      kind: "individual" | "group";
      groupName: string | null;
      learnerName: string | null;
      teacherName: string;
    },
    viewer: "teacher" | "learner" | "guardian",
  ) => {
    if (s.title) return s.title;
    if (s.kind === "group" && s.groupName)
      return t("group", { name: s.groupName });
    const other = viewer === "teacher" ? s.learnerName : s.teacherName;
    return other ? t("defaultTitle", { name: other }) : t("session");
  };
}
