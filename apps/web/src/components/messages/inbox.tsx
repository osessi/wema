"use client";

import { ChatCircleText, ChatsCircle } from "@phosphor-icons/react";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import { cn } from "@wema/ui/lib/utils";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { mutate } from "../../lib/mutate";
import { NewMessageDialog } from "./new-message-dialog";
import { ThreadList } from "./thread-list";
import { ThreadView } from "./thread-view";
import type {
  Contact,
  TeachingClass,
  ThreadDetail,
  ThreadItem,
  Tone,
} from "./types";

/** Intervalle de rafraîchissement quand l'onglet est visible. */
const REFRESH_MS = 15_000;

/** Lecture côté navigateur ; `null` en cas d'échec (sans session : retour à la connexion). */
async function getJson<T>(path: string, onUnauthenticated: () => void) {
  try {
    const res = await fetch(`/api${path}`, { credentials: "same-origin" });
    if (res.status === 401) {
      onUnauthenticated();
      return null;
    }
    if (!res.ok) return null;
    const data: T = await res.json();
    return data;
  } catch {
    return null;
  }
}

/**
 * Messagerie d'un espace : liste des fils à gauche, fil ouvert à droite ;
 * sur mobile, l'un puis l'autre. Rafraîchie à intervalle régulier et au
 * retour sur l'onglet.
 */
export function Inbox({
  tone,
  initialThreads,
  contacts,
  classes,
}: {
  tone: Tone;
  initialThreads: ThreadItem[];
  contacts: Contact[];
  classes: TeachingClass[];
}) {
  const t = useTranslations("messages");
  const router = useRouter();
  const [threads, setThreads] = useState(initialThreads);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ThreadDetail | null>(null);
  const [loadError, setLoadError] = useState(false);
  const selectedRef = useRef<string | null>(null);
  selectedRef.current = selectedId;
  const lastSeenRef = useRef<string | null>(null);

  const toLogin = useCallback(() => router.push("/connexion"), [router]);

  const refreshThreads = useCallback(async () => {
    const data = await getJson<{ threads: ThreadItem[] }>(
      "/messages/threads",
      toLogin,
    );
    if (data) setThreads(data.threads);
  }, [toLogin]);

  const refreshDetail = useCallback(
    async (id: string) => {
      const data = await getJson<ThreadDetail>(
        `/messages/threads/${id}`,
        toLogin,
      );
      // L'utilisateur a pu changer de fil pendant le chargement.
      if (selectedRef.current !== id) return;
      if (!data) {
        setLoadError(true);
        return;
      }
      setLoadError(false);
      setDetail(data);
      const last = data.messages.at(-1)?.id ?? null;
      // Nouveau contenu affiché à l'écran : on le marque lu.
      if (
        last &&
        last !== lastSeenRef.current &&
        document.visibilityState === "visible"
      ) {
        lastSeenRef.current = last;
        await mutate("POST", `/messages/threads/${id}/read`);
        await refreshThreads();
      }
    },
    [toLogin, refreshThreads],
  );

  const refreshAll = useCallback(async () => {
    await refreshThreads();
    if (selectedRef.current) await refreshDetail(selectedRef.current);
  }, [refreshThreads, refreshDetail]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refreshAll();
    }, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshAll();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [refreshAll]);

  const open = (id: string) => {
    setSelectedId(id);
    selectedRef.current = id;
    lastSeenRef.current = null;
    setDetail(null);
    setLoadError(false);
    void refreshDetail(id);
  };

  const close = () => {
    setSelectedId(null);
    setDetail(null);
  };

  /** Après un envoi : fil à jour, liste à jour. */
  const afterSend = async (threadId: string) => {
    if (selectedRef.current !== threadId) open(threadId);
    else await refreshDetail(threadId);
    await refreshThreads();
  };

  const dialog = (
    <NewMessageDialog
      tone={tone}
      contacts={contacts}
      classes={classes}
      onSent={(threadId) => void afterSend(threadId)}
    />
  );
  const hasContacts = contacts.length > 0 || classes.length > 0;

  // Aucune conversation : un seul état vide, centré, avec l'action.
  if (threads.length === 0 && !selectedId)
    return (
      <EmptyState
        icon={<ChatsCircle weight="fill" />}
        tone="mint"
        title={t("emptyTitle")}
        titleAs="h2"
        description={hasContacts ? t(`${tone}.empty`) : t(`${tone}.noContacts`)}
        action={dialog}
        className="py-16"
      />
    );

  return (
    <div className="space-y-4">
      <div className="flex justify-end">{dialog}</div>
      <div className="grid h-[calc(100dvh-14rem)] min-h-[28rem] grid-cols-[minmax(0,1fr)] overflow-hidden rounded-card border bg-card shadow-xs md:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]">
        <div
          className={cn(
            "min-h-0 md:border-r",
            selectedId ? "hidden md:block" : "block",
          )}
        >
          <ThreadList
            tone={tone}
            threads={threads}
            selectedId={selectedId}
            onSelect={open}
            hasContacts={hasContacts}
          />
        </div>
        <div
          className={cn("min-h-0", selectedId ? "block" : "hidden md:block")}
        >
          {selectedId ? (
            <ThreadView
              tone={tone}
              threadId={selectedId}
              detail={detail}
              loadError={loadError}
              onBack={close}
              onSent={(threadId) => void afterSend(threadId)}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-surface-sunk/40 p-6">
              <EmptyState
                variant="inline"
                icon={<ChatCircleText weight="fill" />}
                tone="mint"
                title={t(`${tone}.pick`)}
                titleAs="p"
                description={t("pickHint")}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
