"use client";

import { Label } from "@wema/ui/components/ui/label";
import { Switch } from "@wema/ui/components/ui/switch";
import { cn } from "@wema/ui/lib/utils";
import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useState } from "react";

// L'API n'a pas de préférence « lecture facile » : elle est gardée sur
// l'appareil (réglage d'affichage, sans effet sur le profil).
const KEY = "wema.learner.easyReading";
const EVENT = "wema:easy-reading";

function readEasy(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function writeEasy(value: boolean) {
  try {
    window.localStorage.setItem(KEY, value ? "1" : "0");
  } catch {
    // Stockage indisponible : le réglage vaut pour cette page seulement.
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: value }));
}

function useEasyReading(): [boolean, (v: boolean) => void] {
  const [easy, setEasy] = useState(false);
  useEffect(() => {
    setEasy(readEasy());
    const listener = (e: Event) =>
      setEasy(e instanceof CustomEvent ? e.detail === true : readEasy());
    window.addEventListener(EVENT, listener);
    return () => window.removeEventListener(EVENT, listener);
  }, []);
  return [
    easy,
    (v) => {
      setEasy(v);
      writeEasy(v);
    },
  ];
}

/** Applique la police de lecture facile (Lexend) à l'espace élève si elle est choisie. */
export function EasyReadingScope({ children }: { children: ReactNode }) {
  const [easy] = useEasyReading();
  return (
    <div
      className={cn(
        "flex flex-1 flex-col gap-6",
        easy && "font-easy [&_*]:font-easy text-[1.05rem] leading-relaxed",
      )}
    >
      {children}
    </div>
  );
}

/** Interrupteur « lecture facile ». */
export function EasyReadingSwitch() {
  const t = useTranslations("learner.profile");
  const [easy, setEasy] = useEasyReading();
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <Label htmlFor="easy-reading">{t("easyReading")}</Label>
        <p className="text-sm text-muted-foreground">{t("easyReadingHelp")}</p>
      </div>
      <Switch id="easy-reading" checked={easy} onCheckedChange={setEasy} />
    </div>
  );
}
