"use client";

import { SpeakerHigh, Stop } from "@phosphor-icons/react";
import { Button } from "@wema/ui/components/ui/button";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { pickVoice, speakable, speechLang, useCanSpeak } from "./speech";

/**
 * Bouton « Écouter » : lit le texte avec la voix du navigateur, dans la
 * langue de l'interface si une voix existe. Masqué si le navigateur ne sait pas lire.
 */
export function ListenButton({
  text,
  label,
  size = "sm",
}: {
  text: string;
  /** Libellé du bouton (par défaut « Écouter »). */
  label?: string;
  size?: "sm" | "xs";
}) {
  const t = useTranslations("learner.voice");
  const locale = useLocale();
  const canSpeak = useCanSpeak();
  const [speaking, setSpeaking] = useState(false);
  const current = useRef<SpeechSynthesisUtterance | null>(null);

  // On arrête la lecture si le bouton disparaît (changement de page).
  useEffect(
    () => () => {
      if (current.current) window.speechSynthesis.cancel();
    },
    [],
  );

  if (!canSpeak || text.trim() === "") return null;

  function toggle() {
    const synth = window.speechSynthesis;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    // Une seule lecture à la fois, dans toute la page.
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(
      speakable(text, {
        sqrt: t("say.sqrt"),
        squared: t("say.squared"),
        cubed: t("say.cubed"),
        times: t("say.times"),
        approx: t("say.approx"),
      }),
    );
    const lang = speechLang(locale);
    utterance.lang = lang;
    const voice = pickVoice(synth.getVoices(), lang);
    if (voice) utterance.voice = voice;
    utterance.rate = 0.95;
    const done = () => {
      if (current.current === utterance) {
        current.current = null;
        setSpeaking(false);
      }
    };
    utterance.onend = done;
    utterance.onerror = done;
    current.current = utterance;
    setSpeaking(true);
    synth.speak(utterance);
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size={size}
      onClick={toggle}
      aria-pressed={speaking}
      className="text-muted-foreground"
    >
      {speaking ? <Stop /> : <SpeakerHigh />}
      {speaking ? t("stop") : (label ?? t("listen"))}
    </Button>
  );
}
