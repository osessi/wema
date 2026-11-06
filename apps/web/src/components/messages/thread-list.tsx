"use client";

import { MegaphoneSimple } from "@phosphor-icons/react";
import { Avatar, AvatarFallback } from "@wema/ui/components/ui/avatar";
import { Badge } from "@wema/ui/components/ui/badge";
import { cn } from "@wema/ui/lib/utils";
import { useTranslations } from "next-intl";
import type { ThreadItem, Tone } from "./types";
import { When } from "./when";

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

/** Titre d'un fil : l'autre personne, ou la classe pour les annonces. */
export function useThreadTitle() {
  const t = useTranslations("messages");
  return (thread: {
    kind: "direct" | "class";
    otherName: string | null;
    className: string | null;
  }) =>
    thread.kind === "class"
      ? t("classThread", { name: thread.className ?? "" })
      : (thread.otherName ?? "");
}

export function ThreadList({
  tone,
  threads,
  selectedId,
  onSelect,
  hasContacts,
}: {
  tone: Tone;
  threads: ThreadItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  hasContacts: boolean;
}) {
  const t = useTranslations("messages");
  const title = useThreadTitle();
  const you = tone === "learner" ? t("youLearner") : t("you");
  if (threads.length === 0)
    return (
      <p className="p-6 text-sm text-muted-foreground">
        {hasContacts ? t(`${tone}.empty`) : t(`${tone}.noContacts`)}
      </p>
    );
  return (
    <nav aria-label={t("threads")} className="h-full overflow-y-auto">
      <ul className="divide-y">
        {threads.map((thread) => {
          const name = title(thread);
          const mine =
            thread.lastMessage !== null &&
            thread.lastMessage.senderId !== null &&
            thread.otherId !== thread.lastMessage.senderId &&
            thread.kind === "direct";
          return (
            <li key={thread.id}>
              <button
                type="button"
                onClick={() => onSelect(thread.id)}
                aria-current={thread.id === selectedId ? "true" : undefined}
                className={cn(
                  "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted",
                  thread.id === selectedId && "bg-muted",
                )}
              >
                <Avatar className="size-9 shrink-0">
                  <AvatarFallback className="bg-surface-sunk text-xs">
                    {thread.kind === "class" ? (
                      <MegaphoneSimple aria-hidden className="size-4" />
                    ) : (
                      initials(name)
                    )}
                  </AvatarFallback>
                </Avatar>
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="flex items-baseline justify-between gap-2">
                    <span
                      className={cn(
                        "truncate text-sm",
                        thread.unread > 0 ? "font-semibold" : "font-medium",
                      )}
                    >
                      {name}
                    </span>
                    {thread.lastMessage && (
                      <When
                        at={thread.lastMessage.createdAt}
                        className="shrink-0 text-xs text-muted-foreground"
                      />
                    )}
                  </span>
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm text-muted-foreground">
                      {mine && `${you} : `}
                      {thread.lastMessage?.body}
                    </span>
                    {thread.unread > 0 && (
                      <Badge
                        aria-label={t("unread", { count: thread.unread })}
                        className="shrink-0"
                      >
                        {thread.unread}
                      </Badge>
                    )}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
