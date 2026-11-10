"use client";

import { Sparkle, X } from "@phosphor-icons/react";
import { chooseEncouragement, type EncouragementTrigger } from "@wema/domain";
import { GlowTile } from "@wema/ui/brand";
import { Button } from "@wema/ui/components/ui/button";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

const EVENT = "wema:encourage";
const LAST_KEY = "wema.encouragement.last";
const ACTIVE_KEY = "wema.encouragement.active";
/** Une minute comptée comme active si l'élève a agi dans les 2 dernières minutes. */
const TICK_MS = 60 * 1000;
const IDLE_MS = 2 * 60 * 1000;
/** Le message s'efface seul après ce délai (il se ferme aussi à la main). */
const SHOWN_MS = 12 * 1000;

/** Demande un encouragement : la règle du cœur décide s'il s'affiche. */
export function encourage(trigger: EncouragementTrigger) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: trigger }));
}

const isTrigger = (v: unknown): v is EncouragementTrigger =>
  v === "success" || v === "step" || v === "steady";

// Le navigateur peut refuser le stockage : sans lui, la règle voit « jamais ».
function readLast(): { at: Date; key: string } | null {
  try {
    const raw = window.localStorage.getItem(LAST_KEY);
    const [at, key] = raw ? raw.split("|") : [];
    return at && key ? { at: new Date(Number(at)), key } : null;
  } catch {
    return null;
  }
}
function writeLast(at: Date, key: string) {
  try {
    window.localStorage.setItem(LAST_KEY, `${at.getTime()}|${key}`);
  } catch {}
}
function readActive(): number {
  try {
    return Number(window.sessionStorage.getItem(ACTIVE_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}
function writeActive(ms: number) {
  try {
    window.sessionStorage.setItem(ACTIVE_KEY, String(ms));
  } catch {}
}

/**
 * Zone de bienveillance : un court message, en surimpression discrète, après
 * une réussite, une séance terminée ou un temps de travail régulier. Au plus
 * un par période (règle `chooseEncouragement`), et il se ferme d'un clic.
 */
export function EncouragementHost() {
  const t = useTranslations("learner.encouragement");
  const [shown, setShown] = useState<string | null>(null);
  const lastAction = useRef(Date.now());

  const offer = useCallback(
    (trigger: EncouragementTrigger) => {
      const now = new Date();
      const key = chooseEncouragement({
        trigger,
        now,
        last: readLast(),
        activeMs: readActive(),
      });
      if (!key || !t.has(`messages.${key}`)) return;
      writeLast(now, key);
      if (trigger === "steady") writeActive(0);
      setShown(key);
    },
    [t],
  );

  useEffect(() => {
    const onEncourage = (e: Event) => {
      if (e instanceof CustomEvent && isTrigger(e.detail)) offer(e.detail);
    };
    const onAction = () => {
      lastAction.current = Date.now();
    };
    const tick = window.setInterval(() => {
      if (
        document.visibilityState !== "visible" ||
        Date.now() - lastAction.current > IDLE_MS
      )
        return;
      writeActive(readActive() + TICK_MS);
      offer("steady");
    }, TICK_MS);
    window.addEventListener(EVENT, onEncourage);
    for (const name of ["keydown", "pointerdown", "scroll"])
      window.addEventListener(name, onAction, { passive: true });
    return () => {
      window.clearInterval(tick);
      window.removeEventListener(EVENT, onEncourage);
      for (const name of ["keydown", "pointerdown", "scroll"])
        window.removeEventListener(name, onAction);
    };
  }, [offer]);

  useEffect(() => {
    if (!shown) return;
    const timer = window.setTimeout(() => setShown(null), SHOWN_MS);
    return () => window.clearTimeout(timer);
  }, [shown]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-24 z-50 flex justify-center sm:inset-x-auto sm:right-6 sm:bottom-6"
    >
      {shown && (
        <div
          data-testid="encouragement"
          className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-card border border-brand/30 bg-card/95 p-3.5 shadow-lg backdrop-blur motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500"
        >
          <GlowTile tone="yellow" size={32}>
            <Sparkle weight="fill" />
          </GlowTile>
          <p className="min-w-0 flex-1 pt-1 text-sm leading-relaxed">
            {t(`messages.${shown}`)}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("close")}
            onClick={() => setShown(null)}
          >
            <X />
          </Button>
        </div>
      )}
    </div>
  );
}
