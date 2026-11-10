import * as Speech from "expo-speech";
import { useId, useSyncExternalStore } from "react";
import { m } from "../i18n/fr";

/** Texte prêt à être lu : symboles remplacés par des mots, Markdown retiré. */
export function speakable(text: string, words = m.voice.say): string {
  return text
    .replace(/\*\*|__|`|\$/g, "")
    .replace(/√\s*\(/g, ` ${words.sqrt} (`)
    .replace(/√/g, ` ${words.sqrt} `)
    .replace(/sqrt\s*\(/g, ` ${words.sqrt} (`)
    .replace(/²|\^\s*2(?!\d)/g, ` ${words.squared}`)
    .replace(/³|\^\s*3(?!\d)/g, ` ${words.cubed}`)
    .replace(/[×·]/g, ` ${words.times} `)
    .replace(/≈/g, ` ${words.approx} `)
    .replace(/\s+/g, " ")
    .trim();
}

let current: string | null = null;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const setCurrent = (id: string | null) => {
  current = id;
  for (const l of listeners) l();
};

/**
 * Lecture à voix haute avec la voix du téléphone (expo-speech), sans appel à
 * une IA. Une seule lecture à la fois : lancer un texte arrête le précédent.
 */
export function useSpeaker() {
  const id = useId();
  const playing = useSyncExternalStore(subscribe, () => current);
  const done = () => {
    if (current === id) setCurrent(null);
  };
  return {
    speaking: playing === id,
    speak(text: string) {
      void Speech.stop();
      setCurrent(id);
      Speech.speak(speakable(text), {
        language: "fr-FR",
        onDone: done,
        onStopped: done,
        onError: done,
      });
    },
    stop() {
      void Speech.stop();
      setCurrent(null);
    },
  };
}
