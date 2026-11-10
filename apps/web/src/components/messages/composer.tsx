"use client";

import { ChatComposer } from "@wema/ui/components/wema/chat";
import { useTranslations } from "next-intl";
import { useState } from "react";
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

  async function submit(value: string) {
    if (!value || pending) return;
    const sent = await send(`/messages/threads/${threadId}/messages`, {
      body: value,
    });
    if (sent) {
      setDraft("");
      onSent(sent);
    }
  }

  return (
    <ChatComposer
      value={draft}
      onValueChange={setDraft}
      onSend={(value) => void submit(value)}
      pending={pending}
      error={error}
      labels={{
        input: t(`${tone}.placeholder`),
        placeholder: t(`${tone}.placeholder`),
        send: t(`${tone}.send`),
        sending: t(`${tone}.sending`),
      }}
      className="border-t p-3"
    />
  );
}
