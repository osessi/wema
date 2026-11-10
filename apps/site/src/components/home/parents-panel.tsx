"use client";

/**
 * Espace parent, sur le modèle de `wa/components/v2/control-panel.tsx` :
 * grand cadre sombre, quatre cellules animées séparées par un filet.
 */

import { Check, DownloadSimple, Lock, Trash } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { sceneReveal, useSceneStep } from "../../wa/components/v2/doors-motion";
import { Frame } from "../../wa/components/v2/primitives";
import { cn } from "../../wa/ui/lib/utils";

function Cell({
  label,
  title,
  children,
  className,
}: {
  readonly label: string;
  readonly title: string;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <div
      className={cn("flex flex-col gap-5 bg-[#151610] p-6 sm:p-7", className)}
    >
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[12px] font-medium tracking-[0.08em] text-white/60 uppercase">
          {label}
        </span>
        <h3 className="text-[22px] leading-tight font-semibold tracking-[-0.02em] text-white sm:text-[24px]">
          {title}
        </h3>
      </div>
      <div className="flex flex-1 flex-col justify-end">{children}</div>
    </div>
  );
}

const NOTIONS = [
  { name: "Fractions", level: 3 },
  { name: "Priorités", level: 3 },
  { name: "Puissances", level: 2 },
  { name: "Équations", level: 2 },
  { name: "Aire", level: 1, grows: true },
  { name: "Périmètre", level: 2 },
  { name: "Pythagore", level: 0 },
  { name: "Proportions", level: 1 },
] as const;

const LEVELS = [
  { label: "Pas vu", cls: "border-white/10 bg-white/[0.04] text-white/45" },
  { label: "En cours", cls: "border-brand/30 bg-brand/15 text-brand" },
  { label: "Presque", cls: "border-brand/50 bg-brand/40 text-white" },
  { label: "Acquis", cls: "border-brand bg-brand text-[#0D0E0B]" },
] as const;

function MasteryCell() {
  const { ref, step } = useSceneStep<HTMLDivElement>(3, 1300, 3200);
  return (
    <Cell
      label="Carte de maîtrise · maths"
      title="Ce qu'il sait, notion par notion."
    >
      <div ref={ref} className="flex flex-col gap-3">
        <ul className="grid grid-cols-2 gap-1.5 min-[440px]:grid-cols-4">
          {NOTIONS.map((n) => {
            const level =
              "grows" in n && n.grows ? Math.min(3, n.level + step) : n.level;
            const meta = LEVELS[level] ?? LEVELS[0];
            return (
              <li
                key={n.name}
                className={cn(
                  "flex flex-col gap-0.5 rounded-[8px] border px-2.5 py-2 transition-colors duration-500",
                  meta.cls,
                )}
              >
                <span className="truncate text-[13px] font-semibold">
                  {n.name}
                </span>
                <span className="font-mono text-[10.5px] opacity-80">
                  {meta.label}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="flex items-center justify-between gap-3 text-[13px] text-white/60">
          <span>Aire : 3 exercices réussis d'affilée</span>
          <span className="font-mono text-[12px] text-white/75">
            Preuves à l'appui
          </span>
        </p>
      </div>
    </Cell>
  );
}

function WeekCell() {
  const { ref, step } = useSceneStep<HTMLDivElement>(3, 1400, 3600);
  const stats = [
    { k: "Temps de travail", v: "2 h 40" },
    { k: "Exercices faits", v: "18" },
    { k: "Notions revues", v: "4" },
  ];
  return (
    <Cell
      label="Résumé de la semaine"
      title="Le dimanche, l'essentiel en une page."
    >
      <div ref={ref} className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-[10px] bg-white/10">
          {stats.map((st) => (
            <div key={st.k} className="bg-[#1b1c15] px-3 py-2.5">
              <span className="block font-mono text-[18px] font-semibold text-white tabular-nums">
                {st.v}
              </span>
              <span className="block text-[11.5px] leading-tight text-white/55">
                {st.k}
              </span>
            </div>
          ))}
        </div>
        <div className="rounded-[12px] border border-white/10 bg-white/[0.04] p-3.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] font-medium text-white/70">
              À revoir
            </span>
            <span className="shrink-0 rounded-[6px] bg-[#F5C451] px-2 py-0.5 font-mono text-[12px] font-semibold text-[#0D0E0B]">
              Aire du rectangle
            </span>
          </div>
          <p
            className={cn(
              "mt-2 text-[14px] leading-snug text-white/85",
              sceneReveal(step >= 1),
            )}
          >
            Preuve : 3 erreurs du même type, dont le contrôle du 14 novembre.
          </p>
          <p
            className={cn(
              "mt-1.5 text-[13px] leading-snug text-white/60",
              sceneReveal(step >= 2),
            )}
          >
            Prévu : 2 exercices et une révision vendredi.
          </p>
        </div>
      </div>
    </Cell>
  );
}

const ADAPTS = [
  "Police lecture facile",
  "Consignes découpées",
  "Pauses courtes",
  "Lecture audio",
];

function NeedsCell() {
  const { ref, step } = useSceneStep<HTMLDivElement>(
    ADAPTS.length + 1,
    700,
    3600,
  );
  const byTeacher = step === ADAPTS.length;
  return (
    <Cell
      label="Besoins particuliers"
      title="Dys ou TDAH : déclaré, jamais diagnostiqué."
    >
      <div ref={ref} className="flex flex-col gap-3">
        <div className="relative grid grid-cols-2 rounded-[10px] bg-white/[0.06] p-1">
          <span
            aria-hidden="true"
            className={cn(
              "absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-[7px] bg-white transition-transform duration-500 ease-out",
              byTeacher && "translate-x-full",
            )}
          />
          <span
            className={cn(
              "relative px-1 py-2 text-center text-[13px] font-semibold transition-colors duration-500",
              byTeacher ? "text-white/65" : "text-[#0D0E0B]",
            )}
          >
            Par le parent
          </span>
          <span
            className={cn(
              "relative px-1 py-2 text-center text-[13px] font-semibold transition-colors duration-500",
              byTeacher ? "text-[#0D0E0B]" : "text-white/65",
            )}
          >
            Par le prof, avec accord
          </span>
        </div>
        <ul className="grid grid-cols-1 gap-2 min-[440px]:grid-cols-2">
          {ADAPTS.map((a, i) => {
            const on = step > i || byTeacher;
            return (
              <li
                key={a}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-[10px] border px-3 py-2.5 transition-colors duration-500",
                  on
                    ? "border-white/15 bg-white/[0.07]"
                    : "border-white/10 bg-white/[0.03]",
                )}
              >
                <span className="text-[13.5px] font-medium text-white/85">
                  {a}
                </span>
                <span
                  className={cn(
                    "font-mono text-[11.5px] font-semibold transition-colors duration-500",
                    on ? "text-brand" : "text-white/40",
                  )}
                >
                  {on ? "Activée" : "·"}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="text-[13px] text-white/60">
          L'IA adapte la forme. Elle ne pose aucun diagnostic.
        </p>
      </div>
    </Cell>
  );
}

function DataCell() {
  const { ref, step } = useSceneStep<HTMLDivElement>(4, 1200, 3200);
  return (
    <Cell
      label="Vos données"
      title="Exportées ou supprimées, quand vous voulez."
    >
      <div ref={ref} className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 rounded-[12px] border border-white/10 bg-white/[0.04] p-3.5">
          <span className="flex min-w-0 items-center gap-2.5">
            <DownloadSimple
              size={18}
              className="shrink-0 text-white/80"
              aria-hidden="true"
            />
            <span className="min-w-0">
              <span className="block text-[14px] font-semibold text-white">
                Exporter
              </span>
              <span className="block truncate text-[12.5px] text-white/55">
                Profil, exercices, échanges
              </span>
            </span>
          </span>
          <span
            className={cn(
              "shrink-0 rounded-[8px] px-2.5 py-1 font-mono text-[12px] font-semibold transition-colors duration-500",
              step >= 1 ? "bg-brand text-[#0D0E0B]" : "bg-white text-[#0D0E0B]",
            )}
          >
            {step >= 1 ? "Fichier prêt" : "Demander"}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-[12px] border border-white/10 bg-white/[0.04] p-3.5">
          <span className="flex min-w-0 items-center gap-2.5">
            <Trash
              size={18}
              className="shrink-0 text-white/80"
              aria-hidden="true"
            />
            <span className="min-w-0">
              <span className="block text-[14px] font-semibold text-white">
                Supprimer
              </span>
              <span className="block truncate text-[12.5px] text-white/55">
                Le compte de l'élève et son historique
              </span>
            </span>
          </span>
          <span
            className={cn(
              "shrink-0 rounded-[8px] border px-2.5 py-1 font-mono text-[12px] font-semibold transition-colors duration-500",
              step >= 3
                ? "border-brand bg-brand/15 text-brand"
                : step >= 2
                  ? "border-white/40 text-white"
                  : "border-white/15 text-white/70",
            )}
          >
            {step >= 3 ? "Confirmé" : step >= 2 ? "Confirmer ?" : "Demander"}
          </span>
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-white/65">
          <li className="flex items-center gap-1.5">
            <Lock size={13} aria-hidden="true" /> Santé : accès restreint
          </li>
          <li className="flex items-center gap-1.5">
            <Check size={13} aria-hidden="true" /> Aucune publicité
          </li>
        </ul>
      </div>
    </Cell>
  );
}

export function ParentsPanel() {
  return (
    <Frame tone="graphite">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-6 py-4 sm:px-7">
        <span className="flex items-center gap-2.5">
          <span className="inline-flex size-7 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-[#0D0E0B]">
            IN
          </span>
          <span className="text-[15px] font-semibold text-white">
            Espace parent · Inès, 4e
          </span>
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[12px] font-medium text-white/60">
          <span className="rounded-[7px] border border-brand/40 bg-brand/15 px-2 py-0.5 text-brand">
            Maths
          </span>
          <span className="hidden rounded-[7px] border border-white/10 bg-white/[0.06] px-2 py-0.5 min-[420px]:inline">
            Semaine 46
          </span>
        </span>
      </div>
      <div className="grid grid-cols-1 gap-px bg-white/10 md:grid-cols-2">
        <MasteryCell />
        <WeekCell />
        <NeedsCell />
        <DataCell />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-white/10 px-6 py-4 sm:px-7">
        <span className="text-[14px] font-medium text-white/75">
          Jamais la réponse, même quand l'élève insiste.
        </span>
        <span className="font-mono text-[12px] font-semibold tracking-[0.06em] text-white/75 uppercase">
          Exemple fictif
        </span>
      </div>
    </Frame>
  );
}
