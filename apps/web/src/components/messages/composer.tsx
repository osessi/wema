"use client";

import { PaperPlaneRight } from "@phosphor-icons/react";
import { Button } from "@wema/ui/components/ui/button";
import { Textarea } from "@wema/ui/components/ui/textarea";
import { useTranslations } from "next-intl";
import { type FormEvent, type KeyboardEvent, useState } from "react";
import { mutate } from "../../lib/mutate";
import type { Tone } from "./types";

const KNOWN = new Set(["forbidden", "too_many_messages", "network"]);

/** Envoie un message ; renvoie le fil où il a été posté, ou l'erreur traduite. */
export function useSend() {
  const t = useTranslations("messages.errors");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function send(path: string, body: unknown): Promise<string | null> {
    setPending(true);
    setError(null);
    const result = await mutate("POST", path, body);
    setPending(false);
    if (!result.ok) {
      setError(t(KNOWN.has(result.code) ? result.code : "generic"));
      return null;
    }
    const threadId =
      typeof result.data === "object" &&
      result.data !== null &&
      "threadId" in result.data &&
      typeof result.data.threadId === "string"
        ? result.data.threadId
        : null;
    return threadId;
  }
  return { send, pending, error };
}

/** Zone de saisie d'un fil : Entrée envoie, Maj+Entrée va à la ligne. */
export function Composer({
  tone,
  threadId,
  onSent,
}: {
  tone: Tone;
  threadId: string;
  onSent: (threadId: string) => void;
}) {
  const t = useTranslations("messages");
  const [draft, setDraft] = useState("");
  const { send, pending, error } = useSend();

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    const body = draft.trim();
    if (!body || pending) return;
    const sent = await send(`/messages/threads/${threadId}/messages`, { body });
    if (sent) {
      setDraft("");
      onSent(sent);
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <form onSubmit={submit} className="space-y-2 border-t p-3">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex items-end gap-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t(`${tone}.placeholder`)}
          aria-label={t(`${tone}.placeholder`)}
          maxLength={4000}
          rows={2}
          className="min-h-11 resize-none"
        />
        <Button type="submit" disabled={pending || !draft.trim()}>
          <PaperPlaneRight aria-hidden />
          <span className="sr-only sm:not-sr-only">
            {pending ? t(`${tone}.sending`) : t(`${tone}.send`)}
          </span>
        </Button>
      </div>
    </form>
  );
}
