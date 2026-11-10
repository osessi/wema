"use client";

/**
 * Bannière qu'on peut fermer : un encouragement, une annonce ou une information,
 * sur un ton bienveillant.
 *
 * Source : écrit pour Wema, d'après la ligne d'attention d'`overview-hero` de ZeroAds
 * (code d'Olivier : une phrase marquée plutôt qu'un bandeau criard). Pastille
 * `GlowTile`, arrondi `card`, sortie en douceur (coupée si l'utilisateur réduit les
 * animations). Pas de points ni de série : un mot gentil, une action au plus.
 *
 * Props :
 * - `tone` : `encourage` (jaune, défaut), `announce` (encre), `info` (ardoise), `success` (menthe).
 * - `icon` : glyphe Phosphor (défaut selon le ton) ; `title`, `description`, `action`.
 * - `onDismiss()` : appelé à la fermeture (l'appelant retient le choix s'il le faut) ;
 *   sans `onDismiss`, pas de bouton de fermeture. `dismissLabel` (« Fermer »).
 * - `open` : contrôle externe facultatif ; sinon la bannière gère son propre état.
 */
import {
  HandHeartIcon,
  InfoIcon,
  MegaphoneSimpleIcon,
  SealCheckIcon,
  XIcon,
} from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type ReactNode, useState } from "react";
import { cn } from "../../lib/utils";
import { GlowTile, type GlowTone } from "../brand/glow-tile";
import { ARRIVE, DUR } from "../brand/motion";

export type NudgeTone = "encourage" | "announce" | "info" | "success";

const TONE: Record<
  NudgeTone,
  { frame: string; glow: GlowTone; icon: ReactNode }
> = {
  encourage: {
    frame: "border-brand/50 bg-brand-subtle",
    glow: "yellow",
    icon: <HandHeartIcon weight="fill" />,
  },
  announce: {
    frame: "border-border bg-card",
    glow: "slate",
    icon: <MegaphoneSimpleIcon weight="fill" />,
  },
  info: {
    frame: "border-info/30 bg-info-soft",
    glow: "sky",
    icon: <InfoIcon weight="fill" />,
  },
  success: {
    frame: "border-success/30 bg-success-soft",
    glow: "mint",
    icon: <SealCheckIcon weight="fill" />,
  },
};

export interface NudgeProps {
  readonly tone?: NudgeTone | undefined;
  readonly icon?: ReactNode;
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly action?: ReactNode;
  readonly onDismiss?: (() => void) | undefined;
  readonly dismissLabel?: string | undefined;
  readonly open?: boolean | undefined;
  readonly className?: string | undefined;
}

export function Nudge({
  tone = "encourage",
  icon,
  title,
  description,
  action,
  onDismiss,
  dismissLabel = "Fermer",
  open,
  className,
}: NudgeProps) {
  const [own, setOwn] = useState(true);
  const shown = open ?? own;
  const reduce = useReducedMotion() ?? false;
  const t = TONE[tone];
  return (
    <AnimatePresence initial={false}>
      {shown ? (
        <motion.aside
          initial={reduce ? false : { opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={
            reduce
              ? { opacity: 0, transition: { duration: 0 } }
              : { opacity: 0, y: -6, scale: 0.98 }
          }
          transition={{ duration: DUR.panel, ease: ARRIVE }}
          className={cn(
            "flex items-start gap-3 rounded-card border p-4",
            t.frame,
            className,
          )}
          data-slot="nudge"
          data-tone={tone}
        >
          <GlowTile tone={t.glow} size={36} aria-hidden>
            {icon ?? t.icon}
          </GlowTile>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-sm font-medium text-foreground">{title}</p>
            {description ? (
              <p className="mt-0.5 text-[13px] text-pretty text-muted-foreground">
                {description}
              </p>
            ) : null}
            {action ? (
              <div className="mt-3 flex flex-wrap gap-2">{action}</div>
            ) : null}
          </div>
          {onDismiss ? (
            <button
              type="button"
              aria-label={dismissLabel}
              onClick={() => {
                setOwn(false);
                onDismiss();
              }}
              className="-m-1 grid size-8 shrink-0 place-items-center rounded-control text-muted-foreground transition-colors duration-150 outline-none hover:bg-foreground/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
            >
              <XIcon aria-hidden className="size-4" />
            </button>
          ) : null}
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
