"use client";

import { ArrowLeft } from "@phosphor-icons/react";
import { Button } from "@wema/ui/components/ui/button";
import { Skeleton } from "@wema/ui/components/ui/skeleton";
import { ChatBubble, ChatThread } from "@wema/ui/components/wema/chat";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { Fragment } from "react";
import { Composer } from "./composer";
import { ThreadAvatar, useThreadTitle } from "./thread-list";
import type { ThreadDetail, Tone } from "./types";

/** Clé de jour locale (AAAA-MM-JJ) d'une date. */
const dayKey = (d: Date) =>
  `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

/** Séparateur de jour, en étiquette mono. */
function DaySeparator({ at }: { at: Date }) {
  const t = useTranslations("messages");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const label =
    dayKey(at) === dayKey(now)
      ? t("today")
      : dayKey(at) === dayKey(yesterday)
        ? t("yesterday")
        : format.dateTime(at, {
            weekday: "long",
            day: "numeric",
            month: "long",
          });
  return (
    <li
      aria-hidden
      className="flex items-center gap-3 py-1 font-mono text-[10px] tracking-wider text-muted-foreground uppercase"
    >
      <span className="h-px flex-1 bg-border" />
      <span suppressHydrationWarning>{label}</span>
      <span className="h-px flex-1 bg-border" />
    </li>
  );
}

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
  const count = detail?.messages.length ?? 0;
  const thread = detail?.thread;
  const name = thread ? title(thread) : "";

  return (
    <section className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b px-4 py-3">
        <Button
          variant="ghost"
          size="icon-sm"
          className="md:hidden"
          onClick={onBack}
          aria-label={t("back")}
        >
          <ArrowLeft aria-hidden />
        </Button>
        {thread ? <ThreadAvatar thread={thread} name={name} /> : null}
        <h2 className="min-w-0 truncate text-base font-semibold tracking-tight">
          {thread ? name : <Skeleton className="h-5 w-40" />}
        </h2>
      </header>

      <div className="flex min-h-0 flex-1 flex-col bg-surface-sunk/40 px-3 py-4 sm:px-5">
        {loadError && !detail && (
          <p className="text-sm text-muted-foreground">{t("loadError")}</p>
        )}
        {!detail && !loadError && (
          <div className="space-y-3">
            <Skeleton className="h-10 w-2/3 rounded-menu" />
            <Skeleton className="ml-auto h-10 w-1/2 rounded-menu" />
          </div>
        )}
        {detail && count === 0 && (
          <p className="m-auto text-sm text-muted-foreground">
            {t(`${tone}.noMessages`)}
          </p>
        )}
        {detail && count > 0 && (
          <ChatThread
            key={threadId}
            label={t("log")}
            scrollLabel={t("scrollDown")}
            className="flex-1"
          >
            {detail.messages.map((m, i) => {
              const at = new Date(m.createdAt);
              const prev = detail.messages[i - 1];
              const newDay =
                !prev || dayKey(new Date(prev.createdAt)) !== dayKey(at);
              return (
                <Fragment key={m.id}>
                  {newDay && <DaySeparator at={at} />}
                  <ChatBubble
                    sender={m.mine ? "self" : "human"}
                    author={
                      !m.mine && thread?.kind === "class" && m.senderName
                        ? m.senderName
                        : undefined
                    }
                    time={at}
                  >
                    {m.body}
                  </ChatBubble>
                </Fragment>
              );
            })}
          </ChatThread>
        )}
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
          <p className="border-t p-4 text-sm text-muted-foreground">
            {thread.kind === "class"
              ? t(`${tone}.readOnly`)
              : t(`${tone}.closed`)}
          </p>
        ))}
    </section>
  );
}
