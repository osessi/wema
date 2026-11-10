"use client";

import { Lightbulb } from "@phosphor-icons/react";
import {
  StreamingText,
  ThinkingIndicator,
} from "@wema/ui/components/patterns/index";
import { Button } from "@wema/ui/components/ui/button";
import {
  ChatBubble,
  ChatComposer,
  ChatThread,
  TypingIndicator,
} from "@wema/ui/components/wema/chat";
import { cn } from "@wema/ui/lib/utils";
import { useEffect, useRef, useState } from "react";
import { Section, Specimen } from "../_components/section";
import type { SectionProps } from "../_components/showcase";

const MAX_HINTS = 3;

/** Indices progressifs : jamais la réponse, du plus léger au plus précis. */
const HINTS = [
  "Regarde bien le triangle : où se trouve l'angle droit ?",
  "Le plus long côté est en face de l'angle droit. Comment s'appelle-t-il ?",
  "Écris l'égalité de Pythagore avec les lettres du triangle, avant de remplacer par les nombres.",
];

/** Réponses de démonstration du prof IA : il questionne, il ne conclut pas. */
const REPLIES = [
  "Bonne idée de commencer par là ! Avant de calculer, dis-moi : quel côté est l'hypoténuse ici ?",
  "Tu y es presque. Qu'obtiens-tu si tu élèves AB et AC au carré ?",
  "Très bien. Compare maintenant ta somme avec BC² : que remarques-tu ?",
];

interface Message {
  id: number;
  sender: "self" | "ai";
  text: string;
  note?: string;
  stream?: boolean;
}

const T0 = new Date("2026-11-10T16:02:00Z");

function TutorDemo() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      sender: "ai",
      text: "Salut Awa ! On reprend le triangle ABC rectangle en A. Par quoi veux-tu commencer ?",
    },
    { id: 2, sender: "self", text: "Je sais pas trop, je dois trouver BC." },
    {
      id: 3,
      sender: "ai",
      text: "C'est un bon début de savoir ce qu'on cherche. Que vaut l'angle en A ?",
    },
    { id: 4, sender: "self", text: "Il est droit, c'est écrit dans l'énoncé." },
    {
      id: 5,
      sender: "ai",
      text: "D'accord. Qu'est-ce que tu sais déjà sur les côtés AB et AC ?",
      note: "Réponse reformulée pour la lecture facile",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [hints, setHints] = useState(0);
  const turn = useRef(0);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  function reply(text: string, note?: string) {
    setThinking(true);
    timer.current = window.setTimeout(() => {
      setThinking(false);
      setMessages((m) => [
        ...m,
        {
          id: m.length + 1,
          sender: "ai",
          text,
          stream: true,
          ...(note ? { note } : {}),
        },
      ]);
    }, 1600);
  }

  function send(value: string) {
    if (!value.trim() || thinking) return;
    setMessages((m) => [
      ...m,
      { id: m.length + 1, sender: "self", text: value },
    ]);
    setDraft("");
    reply(REPLIES[turn.current % REPLIES.length] ?? "");
    turn.current += 1;
  }

  function hint() {
    if (hints >= MAX_HINTS || thinking) return;
    const text = HINTS[hints] ?? "";
    setHints(hints + 1);
    reply(text, `Indice ${hints + 1} sur ${MAX_HINTS}`);
  }

  const left = MAX_HINTS - hints;
  return (
    <div className="flex flex-col overflow-hidden rounded-card border bg-card shadow-xs">
      <ChatThread
        label="Conversation avec le prof IA"
        className="h-[420px] px-4 pt-4 sm:px-6"
      >
        {messages.map((m, i) => (
          <ChatBubble
            key={m.id}
            sender={m.sender}
            author={m.sender === "ai" ? "Prof Kemi" : "Awa"}
            time={new Date(T0.getTime() + i * 60_000)}
            timeZone="Africa/Porto-Novo"
            note={m.note}
            onListen={m.sender === "ai" ? () => undefined : undefined}
          >
            {m.stream ? <StreamingText text={m.text} /> : m.text}
          </ChatBubble>
        ))}
        {thinking ? (
          <ChatBubble sender="ai" author="Prof Kemi">
            <TypingIndicator label="Le prof IA réfléchit" />
          </ChatBubble>
        ) : null}
      </ChatThread>
      <div className="border-t p-3 sm:p-4">
        <ChatComposer
          value={draft}
          onValueChange={setDraft}
          onSend={send}
          pending={thinking}
          onDictateToggle={() => undefined}
          startActions={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={thinking || hints >= MAX_HINTS}
              onClick={hint}
              aria-label={`Indice (${left} restant${left > 1 ? "s" : ""})`}
            >
              <Lightbulb aria-hidden weight="fill" className="text-brand" />
              <span className="hidden sm:inline">Indice</span>
              <span aria-hidden className="inline-flex items-center gap-0.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className={cn(
                      "size-1.5 rounded-full",
                      i < left ? "bg-brand" : "bg-muted-foreground/30",
                    )}
                  />
                ))}
              </span>
            </Button>
          }
        />
      </div>
    </div>
  );
}

export function Tutor({ id, index, title }: SectionProps) {
  const [replay, setReplay] = useState(0);
  // ThinkingIndicator et StreamingText lisent la préférence de mouvement au rendu : affichés après
  // l'hydratation pour que le serveur et le navigateur rendent la même chose.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <Section
      id={id}
      index={index}
      title={title}
      when="La conversation avec le prof IA et la messagerie partagent les mêmes bulles. Le prof IA tutoie l'élève, ne donne jamais la réponse et propose au plus trois indices, du plus léger au plus précis."
    >
      <Specimen
        label="Fil de discussion · ChatThread, ChatBubble, ChatComposer"
        note="Interactif : écrivez un message ou demandez un indice"
        bare
      >
        <TutorDemo />
      </Specimen>
      <div className="grid gap-8 lg:grid-cols-2">
        <Specimen label="Réflexion · ThinkingIndicator">
          {mounted ? (
            <ThinkingIndicator
              words={[
                "Je relis ta réponse",
                "Je cherche un exemple",
                "Je prépare une question",
              ]}
              interval={1800}
            />
          ) : null}
        </Specimen>
        <Specimen
          label="Texte qui arrive · StreamingText"
          note={
            <Button
              size="xs"
              variant="outline"
              onClick={() => setReplay((n) => n + 1)}
            >
              Rejouer
            </Button>
          }
        >
          <p className="text-[15px] leading-relaxed">
            {mounted ? (
              <StreamingText
                key={replay}
                text="Bravo, tu as trouvé la bonne méthode toute seule. Essaie maintenant avec un triangle dont tu connais l'hypoténuse : que change-t-il ?"
              />
            ) : null}
          </p>
        </Specimen>
      </div>
    </Section>
  );
}
