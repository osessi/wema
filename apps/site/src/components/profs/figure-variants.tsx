"use client";

import { CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { useRef } from "react";
import {
  Figure,
  TonePill,
  useFigureClock,
} from "../../wa/components/v2/journey/figure";
import s from "../../wa/components/v2/journey/journey.module.css";
import { cn } from "../../wa/ui/lib/utils";

/** Élèves fictifs : une même notion, quatre formes. */
const LEARNERS = [
  {
    name: "Inès",
    format: "Lecture facile",
    text: "Léo a 3 sacs de billes. Chaque sac en a autant. Avec 4 billes de plus, il en a 19. Combien de billes dans un sac ?",
  },
  {
    name: "Kossi",
    format: "Étapes guidées",
    text: "Étape 1 : appelle x le prix d'un ticket. Étape 2 : 3 tickets et 4 € de frais font 19 €. Écris l'équation.",
  },
  {
    name: "Léa",
    format: "Niveau +1",
    text: "Un club achète 6 places, obtient 13 € de remise et paie 41 €. Quel est le prix d'une place ?",
  },
  {
    name: "Malik",
    format: "Schéma",
    text: null,
  },
] as const;

const CYCLE = LEARNERS.length + 5;

function BarModel() {
  return (
    <div className="mt-1 flex flex-col gap-1">
      <div className="flex gap-1">
        {["x", "x", "x"].map((v, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed drawing.
            key={i}
            className="grid h-6 flex-[3] place-items-center rounded-[4px] border border-[color-mix(in_srgb,var(--tone)_60%,transparent)] bg-[color-mix(in_srgb,var(--tone)_18%,var(--surface))] font-mono text-[11px] font-semibold text-foreground"
          >
            {v}
          </span>
        ))}
        <span className="grid h-6 flex-[2] place-items-center rounded-[4px] border border-[var(--tk-rule)] font-mono text-[11px] text-foreground">
          4
        </span>
      </div>
      <div className="relative h-3 border-x border-b border-[var(--tk-rule)]">
        <span className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 bg-surface px-1 font-mono text-[10px] text-muted-foreground">
          19
        </span>
      </div>
    </div>
  );
}

export function FigureVariants({ index }: { readonly index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const { step: tick, active, reduced } = useFigureClock(ref, 1100, CYCLE - 1);
  const step = tick % CYCLE;
  const shown = Math.min(LEARNERS.length, step);

  return (
    <Figure
      figureRef={ref}
      active={active}
      index={index}
      caption="Un devoir · une variante par élève"
      status={`${shown}/${LEARNERS.length} prêtes`}
      tone="orchid"
    >
      <div className="flex h-full flex-col gap-3 p-3.5 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-[var(--tk-edge)] bg-surface px-3 py-2.5">
          <span className="min-w-0">
            <span className="block font-mono text-[10px] tracking-[0.08em] text-muted-foreground uppercase">
              Exercice retenu
            </span>
            <span className="block truncate text-[13px] font-semibold text-foreground">
              Mettre un problème en équation
            </span>
          </span>
          <TonePill tone="neutral">Évalué : mise en équation</TonePill>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-2 min-[480px]:grid-cols-2">
          {LEARNERS.map((l, i) => {
            const ready = i < shown;
            return (
              <div
                key={l.name}
                className={cn(
                  "flex flex-col gap-1.5 rounded-[10px] border bg-surface p-2.5 transition-[border-color,opacity] duration-500",
                  ready
                    ? "border-[color-mix(in_srgb,var(--tone)_55%,transparent)]"
                    : "border-[var(--tk-line)] opacity-55",
                  ready && i === shown - 1 && !reduced && s.land,
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span className="grid size-6 place-items-center rounded-full bg-foreground/[0.07] text-[10.5px] font-semibold text-foreground/80">
                      {l.name.charAt(0)}
                    </span>
                    <span className="text-[12.5px] font-semibold text-foreground">
                      {l.name}
                    </span>
                  </span>
                  <TonePill tone={ready ? "orchid" : "neutral"}>
                    {l.format}
                  </TonePill>
                </div>
                {ready ? (
                  <div className={cn(!reduced && s.pop)}>
                    {l.text === null ? (
                      <>
                        <p className="text-[11.5px] leading-snug text-foreground/75">
                          Que vaut une case x ?
                        </p>
                        <BarModel />
                      </>
                    ) : (
                      <p className="line-clamp-3 text-[11.5px] leading-snug text-foreground/75">
                        {l.text}
                      </p>
                    )}
                  </div>
                ) : (
                  <span
                    className={cn(
                      "h-9 rounded-[6px]",
                      reduced ? "bg-foreground/[0.06]" : s.shimmer,
                    )}
                  />
                )}
                <span
                  className={cn(
                    "mt-auto flex items-center gap-1 font-mono text-[10px] tracking-[0.04em] uppercase",
                    ready ? "text-foreground/70" : "text-muted-foreground",
                  )}
                >
                  <CheckCircle
                    size={12}
                    weight={ready ? "fill" : "regular"}
                    className={
                      ready ? "text-[#b14fd0] dark:text-[var(--tone)]" : ""
                    }
                  />
                  {ready
                    ? "Vérifiée par le calcul"
                    : "Création de la variante…"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </Figure>
  );
}
