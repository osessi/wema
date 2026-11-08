"use client";

import type { Icon } from "@phosphor-icons/react";
import {
  ChartBar,
  ClockCountdown,
  MagnifyingGlass,
  Notepad,
} from "@phosphor-icons/react/ssr";
import { useRef } from "react";
import { Figure } from "../../wa/components/v2/journey/figure";
import { SectionHeading } from "../../wa/components/v2/primitives";
import { useInView } from "../../wa/components/v2/tsf/tsf-motion";
import { GlowTile, type GlowTone } from "../../wa/ui/components/ui/glow-tile";
import { cn } from "../../wa/ui/lib/utils";

/** Exemple fictif : une élève de 4e, en mathématiques. */
const NOTIONS = [
  { name: "Fractions", value: 92, level: "Acquis" },
  { name: "Priorités opératoires", value: 84, level: "Acquis" },
  { name: "Puissances", value: 63, level: "Presque" },
  { name: "Équations", value: 55, level: "En cours" },
  { name: "Aire et périmètre", value: 31, level: "À revoir" },
  { name: "Pythagore", value: 0, level: "Pas encore vu" },
] as const;

const DAYS = [
  { day: "Lun", min: 25 },
  { day: "Mar", min: 0 },
  { day: "Mer", min: 45 },
  { day: "Jeu", min: 20 },
  { day: "Ven", min: 15 },
  { day: "Sam", min: 35 },
  { day: "Dim", min: 20 },
] as const;
const MAX_MIN = 45;

const TO_REVIEW = [
  {
    notion: "Aire et périmètre",
    why: "Les confond sur 3 exercices sur 5 cette semaine.",
    confidence: "Confiance élevée",
  },
  {
    notion: "Équations",
    why: "Oublie de changer le signe en passant un terme de l'autre côté.",
    confidence: "Confiance moyenne",
  },
] as const;

const CALLOUTS: readonly {
  icon: Icon;
  tone: GlowTone;
  title: string;
  text: string;
}[] = [
  {
    icon: ChartBar,
    tone: "gold",
    title: "La maîtrise, notion par notion",
    text: "Pas une moyenne : chaque notion du programme, de « pas encore vue » à « acquise ».",
  },
  {
    icon: ClockCountdown,
    tone: "indigo",
    title: "Le temps de travail réel",
    text: "Jour par jour, ce qu'il a travaillé et combien de temps.",
  },
  {
    icon: MagnifyingGlass,
    tone: "crimson",
    title: "Les points à revoir, avec leurs preuves",
    text: "Quand Wema dit qu'il bloque, vous voyez sur quels exercices, et avec quelle confiance.",
  },
  {
    icon: Notepad,
    tone: "orchid",
    title: "Le résumé de la semaine",
    text: "Quelques lignes claires, et ce que le prof IA prévoit pour la suite.",
  },
];

function Label({ children }: { readonly children: string }) {
  return (
    <span className="font-mono text-[10.5px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
      {children}
    </span>
  );
}

function ParentFigure() {
  const ref = useRef<HTMLDivElement>(null);
  const { seen, visible } = useInView(ref, 0.25);
  const grow =
    "transition-[width,height] duration-1000 ease-out motion-reduce:transition-none";
  return (
    <Figure
      figureRef={ref}
      active={visible}
      index={0}
      caption="Espace parent · Inès, 4e"
      status="Semaine en cours"
      tone="gold"
    >
      <div className="flex flex-col gap-3 p-3 sm:gap-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-[var(--tk-edge)] bg-surface px-3.5 py-3">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-full bg-brand text-[13px] font-semibold text-[#1a1403]">
              IN
            </span>
            <span className="flex flex-col">
              <span className="text-[14.5px] font-semibold text-foreground">
                Inès · 4e
              </span>
              <span className="text-[12.5px] text-muted-foreground">
                Mathématiques · programme officiel
              </span>
            </span>
          </div>
          <span className="rounded-full bg-foreground/[0.08] px-2.5 py-1 font-mono text-[10.5px] font-semibold tracking-[0.04em] text-foreground/70 uppercase">
            Exemple fictif
          </span>
        </div>

        <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-[10px] border border-[var(--tk-edge)] bg-[var(--tk-line)]">
          {[
            { k: "Travail", v: "2 h 40" },
            { k: "Exercices", v: "23" },
            { k: "Notions revues", v: "4" },
          ].map((s) => (
            <div key={s.k} className="bg-surface px-3 py-3 sm:px-4">
              <dt>
                <Label>{s.k}</Label>
              </dt>
              <dd className="mt-1 text-[24px] leading-none font-light tracking-[-0.03em] text-foreground tabular-nums sm:text-[30px]">
                {s.v}
              </dd>
            </div>
          ))}
        </dl>

        <div className="grid gap-3 sm:gap-4 md:grid-cols-[1.25fr_1fr]">
          <div className="rounded-[10px] border border-[var(--tk-edge)] bg-surface p-3.5 sm:p-4">
            <Label>Maîtrise par notion</Label>
            <ul className="mt-3 flex flex-col gap-2.5">
              {NOTIONS.map((n) => (
                <li key={n.name} className="flex flex-col gap-1">
                  <span className="flex items-baseline justify-between gap-2 text-[12.5px]">
                    <span className="font-medium text-foreground">
                      {n.name}
                    </span>
                    <span
                      className={cn(
                        "font-mono text-[10.5px] tracking-[0.02em]",
                        n.level === "À revoir"
                          ? "font-semibold text-[#c23a48] dark:text-[#ff8f99]"
                          : "text-muted-foreground",
                      )}
                    >
                      {n.level}
                    </span>
                  </span>
                  <span className="relative h-[7px] overflow-hidden rounded-full bg-foreground/[0.07]">
                    <span
                      className={cn(
                        "absolute inset-y-0 left-0 rounded-full",
                        n.level === "À revoir" ? "bg-[#FF4D5E]" : "bg-brand",
                        grow,
                      )}
                      style={{ width: seen ? `${n.value}%` : "0%" }}
                    />
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col rounded-[10px] border border-[var(--tk-edge)] bg-surface p-3.5 sm:p-4">
            <span className="flex items-baseline justify-between gap-2">
              <Label>Temps de travail</Label>
              <span className="font-mono text-[10.5px] text-muted-foreground">
                minutes
              </span>
            </span>
            <div className="mt-auto grid grid-cols-7 gap-1.5 pt-3">
              {DAYS.map((d) => (
                <div key={d.day} className="flex flex-col items-center gap-1">
                  <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                    {d.min > 0 ? d.min : "–"}
                  </span>
                  <span className="flex h-[120px] w-full items-end justify-center sm:h-[150px]">
                    <span
                      className={cn(
                        "w-full max-w-[22px] rounded-t-[4px] bg-[#5B7CFF]",
                        grow,
                      )}
                      style={{
                        height: seen
                          ? `${Math.max(3, (d.min / MAX_MIN) * 100)}%`
                          : "3%",
                        transitionDelay: "0.15s",
                      }}
                    />
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground uppercase">
                    {d.day}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-[10px] border border-[var(--tk-edge)] bg-surface p-3.5 sm:p-4">
          <Label>Points à revoir</Label>
          <ul className="mt-2.5 flex flex-col">
            {TO_REVIEW.map((r) => (
              <li
                key={r.notion}
                className="flex flex-col gap-1.5 border-t border-[var(--tk-line)] py-2.5 first:border-t-0 first:pt-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="text-[13.5px] font-semibold text-foreground">
                    {r.notion}
                  </span>
                  <span className="text-[12.5px] leading-snug text-muted-foreground">
                    {r.why}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full bg-foreground/[0.08] px-2 py-[3px] font-mono text-[10px] font-semibold text-foreground/70">
                    {r.confidence}
                  </span>
                  <span className="font-mono text-[10.5px] font-semibold text-foreground underline decoration-brand decoration-2 underline-offset-4">
                    Voir les preuves
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-[10px] border border-[var(--tk-edge)] bg-[color-mix(in_srgb,var(--brand)_10%,var(--surface))] p-3.5 sm:p-4">
          <Label>Résumé de la semaine</Label>
          <p className="mt-2 border-l-2 border-brand pl-3 text-[13.5px] leading-relaxed text-foreground/85 sm:text-[14px]">
            Inès a travaillé cinq jours sur sept. Les fractions sont acquises.
            Elle confond encore aire et périmètre : le prof IA lui propose des
            exercices avec schéma, le format où elle réussit le mieux, et
            reviendra sur les équations jeudi.
          </p>
        </div>
      </div>
    </Figure>
  );
}

export function ParentSpace() {
  return (
    <section
      id="espace-parent"
      aria-labelledby="parent-space-title"
      className="relative scroll-mt-28 px-4 py-24 sm:px-8 sm:py-32"
    >
      <div className="mx-auto grid w-full max-w-[1240px] gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
        <div className="flex flex-col gap-10 lg:sticky lg:top-28 lg:self-start">
          <SectionHeading
            id="parent-space-title"
            eyebrow="Ce que vous voyez"
            title={[
              "Vous savez où il en est,",
              <span key="l2" className="text-brand-active dark:text-brand">
                sans avoir à demander.
              </span>,
            ]}
            sub="Votre espace parent montre ce qu'il a compris, pas seulement ce qu'il a fait. Chaque affirmation renvoie à ses preuves."
            align="left"
          />
          <ol className="flex flex-col">
            {CALLOUTS.map((c, index) => {
              const CIcon = c.icon;
              return (
                <li
                  key={c.title}
                  className="flex gap-4 border-t border-foreground/10 py-4 last:border-b"
                >
                  <GlowTile tone={c.tone} size={38} className="shrink-0">
                    <CIcon size={18} weight="bold" />
                  </GlowTile>
                  <span className="flex flex-col gap-1">
                    <span className="text-[16.5px] font-semibold tracking-[-0.01em] text-foreground">
                      <span className="mr-2 font-mono text-[11px] font-medium text-foreground/45 tabular-nums">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      {c.title}
                    </span>
                    <span className="text-[15px] leading-relaxed text-foreground/72">
                      {c.text}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="min-w-0">
          <p className="sr-only">
            Exemple fictif de l'espace parent pour Inès, en 4e, en mathématiques
            : 2 h 40 de travail, 23 exercices et 4 notions revues cette semaine
            ; fractions et priorités opératoires acquises ; aire et périmètre à
            revoir ; résumé de la semaine rédigé par le prof IA.
          </p>
          <ParentFigure />
        </div>
      </div>
    </section>
  );
}
