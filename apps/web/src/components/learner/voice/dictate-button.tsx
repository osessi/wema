"use client";

import { Microphone, MicrophoneSlash } from "@phosphor-icons/react";
import { Button } from "@wema/ui/components/ui/button";
import { cn } from "@wema/ui/lib/utils";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import {
  type Recognition,
  recognitionConstructor,
  speechLang,
  useCanDictate,
} from "./speech";

/**
 * Bouton « Dicter » : la reconnaissance vocale du navigateur transcrit ce
 * que dit l'élève. `onText` reçoit, à chaque mise à jour, tout ce qui a été
 * dit depuis le début de la dictée (provisoire compris). Masqué si le
 * navigateur ne sait pas dicter.
 */
export function DictateButton({
  onStart,
  onText,
  disabled,
  prominent = false,
}: {
  /** Appelé au début de la dictée (pour garder le texte déjà écrit). */
  onStart?: () => void;
  onText: (spoken: string) => void;
  disabled?: boolean;
  /** Mise en avant (vérification orale : la dictée est la façon naturelle de répondre). */
  prominent?: boolean;
}) {
  const t = useTranslations("learner.voice");
  const locale = useLocale();
  const canDictate = useCanDictate();
  const [listening, setListening] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const recognition = useRef<Recognition | null>(null);

  useEffect(() => () => recognition.current?.abort(), []);

  if (!canDictate) return null;

  function stop() {
    recognition.current?.stop();
  }

  function start() {
    const Ctor = recognitionConstructor();
    if (!Ctor) return;
    // Une lecture à voix haute en cours couvrirait la voix de l'élève.
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    const r = new Ctor();
    r.lang = speechLang(locale);
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (event) => {
      let spoken = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        spoken += result?.[0]?.transcript ?? "";
      }
      onText(spoken.replace(/\s+/g, " ").trim());
    };
    r.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      setProblem(
        event.error === "not-allowed" || event.error === "service-not-allowed"
          ? t("denied")
          : t("dictationError"),
      );
    };
    r.onend = () => {
      recognition.current = null;
      setListening(false);
    };
    setProblem(null);
    onStart?.();
    try {
      r.start();
    } catch {
      setProblem(t("dictationError"));
      return;
    }
    recognition.current = r;
    setListening(true);
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <Button
        type="button"
        variant={listening || prominent ? "default" : "outline"}
        size={prominent ? "lg" : "default"}
        disabled={disabled && !listening}
        onClick={listening ? stop : start}
        aria-pressed={listening}
        className={cn(listening && "animate-pulse")}
      >
        {listening ? <MicrophoneSlash /> : <Microphone />}
        {listening ? t("stopDictation") : t("dictate")}
      </Button>
      <span aria-live="polite" className="text-xs text-muted-foreground">
        {listening ? t("listening") : problem}
      </span>
    </span>
  );
}
