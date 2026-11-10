"use client";

import { MegaphoneSimple } from "@phosphor-icons/react";
import { GlowTile } from "@wema/ui/brand";
import { ILLUSTRATION_FOR } from "@wema/ui/components/illustrations/illustration";
import { Badge } from "@wema/ui/components/ui/badge";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import { PersonAvatar } from "@wema/ui/components/wema/person-avatar";
import { cn } from "@wema/ui/lib/utils";
import { useTranslations } from "next-intl";
import type { ThreadItem, Tone } from "./types";
import { When } from "./when";

/**
 * Pastille d'un fil : avatar coloré de l'autre personne (couleur stable, tirée
 * de son identifiant), ou mégaphone pour une annonce de classe.
 */
export function ThreadAvatar({
  thread,
  name,
  size = "lg",
}: {
  thread: { kind: "direct" | "class"; otherId: string | null };
  name: string;
  size?: "default" | "lg";
}) {
  if (thread.kind === "class")
    return (
      <GlowTile tone="sky" size={size === "lg" ? 40 : 32} glyph="55%">
        <MegaphoneSimple weight="fill" />
      </GlowTile>
    );
  return (
    <PersonAvatar
      name={name}
      seed={thread.otherId ?? name}
      size={size}
      decorative
    />
  );
}

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
      <EmptyState
        variant="inline"
        illustration={ILLUSTRATION_FOR.emptyMessages}
        titleAs="p"
        title={hasContacts ? t(`${tone}.empty`) : t(`${tone}.noContacts`)}
        className="p-6"
      />
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
                  "relative flex w-full items-start gap-3 px-4 py-3 text-left transition-colors outline-none hover:bg-muted/60 focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset motion-reduce:transition-none",
                  thread.id === selectedId &&
                    "bg-brand-soft/60 before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-r-full before:bg-brand hover:bg-brand-soft/60",
                )}
              >
                <ThreadAvatar thread={thread} name={name} />
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
                        className="shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums"
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
                        variant="brand"
                        aria-label={t("unread", { count: thread.unread })}
                        className="shrink-0 tabular-nums"
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
