"use client";

import { ArrowLeft } from "@phosphor-icons/react";
import { Button } from "@wema/ui/components/ui/button";
import { Skeleton } from "@wema/ui/components/ui/skeleton";
import { cn } from "@wema/ui/lib/utils";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { Composer } from "./composer";
import { useThreadTitle } from "./thread-list";
import type { ThreadDetail, Tone } from "./types";
import { When } from "./when";

export function ThreadView({
  tone,
  threadId,
  detail,
  loadError,
  onBack,
  onSent,
}: {
  tone: Tone;
  threadId: string;
  detail: ThreadDetail | null;
  loadError: boolean;
  onBack: () => void;
  onSent: (threadId: string) => void;
}) {
  const t = useTranslations("messages");
  const title = useThreadTitle();
  const end = useRef<HTMLDivElement>(null);
  const count = detail?.messages.length ?? 0;
  const lastId = detail?.messages.at(-1)?.id;

  // Défile jusqu'au dernier message quand il en arrive un.
  useEffect(() => {
    if (lastId) end.current?.scrollIntoView({ block: "end" });
  }, [lastId]);

  const thread = detail?.thread;
  return (
    <section className="flex h-full flex-col" aria-live="polite">
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onBack}
          aria-label={t("back")}
        >
          <ArrowLeft aria-hidden />
        </Button>
        <h2 className="truncate font-display text-lg font-bold">
          {thread ? title(thread) : <Skeleton className="h-5 w-40" />}
        </h2>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {loadError && !detail && (
          <p className="text-sm text-muted-foreground">{t("loadError")}</p>
        )}
        {!detail && !loadError && (
          <div className="space-y-3">
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="ml-auto h-10 w-1/2" />
          </div>
        )}
        {detail && count === 0 && (
          <p className="text-sm text-muted-foreground">
            {t(`${tone}.noMessages`)}
          </p>
        )}
        <ol className="space-y-3">
          {detail?.messages.map((m) => (
            <li
              key={m.id}
              className={cn(
                "flex flex-col",
                m.mine ? "items-end" : "items-start",
              )}
            >
              {!m.mine && thread?.kind === "class" && m.senderName && (
                <span className="mb-0.5 text-xs text-muted-foreground">
                  {m.senderName}
                </span>
              )}
              <p
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm",
                  m.mine
                    ? "rounded-br-sm bg-primary text-primary-foreground"
                    : "rounded-bl-sm border bg-background",
                )}
              >
                {m.body}
              </p>
              <When
                at={m.createdAt}
                className="mt-0.5 text-xs text-muted-foreground"
              />
            </li>
          ))}
        </ol>
        <div ref={end} />
      </div>

      {thread &&
        (thread.canWrite ? (
          <Composer
            key={threadId}
            tone={tone}
            threadId={threadId}
            onSent={onSent}
          />
        ) : (
          <p className="border-t p-3 text-sm text-muted-foreground">
            {thread.kind === "class"
              ? t(`${tone}.readOnly`)
              : t(`${tone}.closed`)}
          </p>
        ))}
    </section>
  );
}
