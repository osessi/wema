"use client";

// Voix côté élève, entièrement dans le navigateur : lecture à voix haute
// (speechSynthesis) et dictée (SpeechRecognition, si le navigateur l'a).
// Aucun appel à un modèle d'IA : le texte dicté devient un message comme un autre.

import { useSyncExternalStore } from "react";

/** Mots lus à la place des symboles mathématiques (traduits, rien de figé). */
export interface SpokenSymbols {
  sqrt: string;
  squared: string;
  cubed: string;
  times: string;
  approx: string;
}

/** Texte prêt à être lu : symboles remplacés par des mots, Markdown retiré. */
export function speakable(text: string, words: SpokenSymbols): string {
  return text
    .replace(/\*\*|__|`|\$/g, "")
    .replace(/√\s*\(/g, ` ${words.sqrt} (`)
    .replace(/√/g, ` ${words.sqrt} `)
    .replace(/²|\^\s*2(?!\d)/g, ` ${words.squared}`)
    .replace(/³|\^\s*3(?!\d)/g, ` ${words.cubed}`)
    .replace(/[×·]/g, ` ${words.times} `)
    .replace(/≈/g, ` ${words.approx} `)
    .replace(/\s+/g, " ")
    .trim();
}

/** Langue à demander au navigateur : la variante préférée de l'élève pour la langue de l'interface. */
export function speechLang(locale: string): string {
  if (typeof navigator === "undefined") return locale;
  return (
    navigator.languages?.find((l) =>
      l.toLowerCase().startsWith(locale.toLowerCase()),
    ) ?? locale
  );
}

/** Voix du navigateur pour la langue : d'abord la variante exacte, puis une voix locale. */
export function pickVoice(
  voices: readonly SpeechSynthesisVoice[],
  lang: string,
): SpeechSynthesisVoice | null {
  const base = lang.toLowerCase().split("-")[0] ?? lang;
  const same = voices.filter((v) =>
    v.lang.toLowerCase().replace("_", "-").startsWith(base),
  );
  return (
    same.find((v) => v.lang.toLowerCase() === lang.toLowerCase()) ??
    same.find((v) => v.localService) ??
    same[0] ??
    null
  );
}

// --- Dictée : types minimaux (l'API n'est pas dans toutes les bibliothèques DOM) ---

export interface RecognitionAlternative {
  transcript: string;
}
export interface RecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: RecognitionAlternative;
}
export interface RecognitionResultEvent {
  readonly resultIndex: number;
  readonly results: {
    readonly length: number;
    [index: number]: RecognitionResult;
  };
}
export interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionConstructor = new () => Recognition;

const isConstructor = (v: unknown): v is RecognitionConstructor =>
  typeof v === "function";

/** Constructeur de reconnaissance vocale du navigateur, ou null s'il n'y en a pas. */
export function recognitionConstructor(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const standard: unknown = Reflect.get(window, "SpeechRecognition");
  if (isConstructor(standard)) return standard;
  const prefixed: unknown = Reflect.get(window, "webkitSpeechRecognition");
  return isConstructor(prefixed) ? prefixed : null;
}

const noSubscribe = () => () => {};

/** Vrai côté navigateur quand la lecture à voix haute est possible (faux au rendu serveur). */
export function useCanSpeak(): boolean {
  return useSyncExternalStore(
    noSubscribe,
    () => typeof window !== "undefined" && "speechSynthesis" in window,
    () => false,
  );
}

/** Vrai côté navigateur quand la dictée est possible (faux au rendu serveur). */
export function useCanDictate(): boolean {
  return useSyncExternalStore(
    noSubscribe,
    () => recognitionConstructor() !== null,
    () => false,
  );
}
