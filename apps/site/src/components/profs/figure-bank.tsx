"use client";

import { Check, Sparkle, X } from "@phosphor-icons/react/dist/ssr";
import { useRef } from "react";
import {
  Figure,
  TonePill,
  useFigureClock,
} from "../../wa/components/v2/journey/figure";
import s from "../../wa/components/v2/journey/journey.module.css";
import { cn } from "../../wa/ui/lib/utils";

type Status = "proposed" | "selected" | "rejected";

/** Exemple de banque d'une semaine, pour une classe de 4e fictive. */
const PROPOSALS: readonly {
  readonly id: string;
  readonly title: string;
  readonly notion: string;
  readonly source: string;
  readonly level: string;
  readonly final: Status;
}[] = [
  {
    id: "b1",
    title: "Résoudre 3x + 7 = 22",
    notion: "Équations du 1er degré",
    source: "Proposé par l'IA",
    level: "N1",
    final: "selected",
  },
  {
    id: "b2",
    title: "Le prix d'un cahier, mis en équation",
    notion: "Mise en équation",
    source: "Bibliothèque Wema",
    level: "N2",
    final: "selected",
  },
  {
    id: "b3",
    title: "Équation avec parenthèses : 2(x − 3) = 10",
    notion: "Équations du 1er degré",
    source: "Proposé par l'IA",
    level: "N2",
    final: "rejected",
  },
  {
    id: "b4",
    title: "Développer (x + 4)(x − 1)",
    notion: "Calcul littéral",
    source: "Proposé par l'IA",
    level: "N3",
    final: "selected",
  },
  {
    id: "b5",
    title: "Problème de partage entre trois amis",
    notion: "Mise en équation",
    source: "Équipe",
    level: "N2",
    final: "proposed",
  },
];

const LABEL: Readonly<Record<Status, string>> = {
  proposed: "À trier",
  selected: "Retenu",
  rejected: "Écarté",
};

const CYCLE = PROPOSALS.length + 5;

export function FigureBank({ index }: { readonly index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const { step: tick, active, reduced } = useFigureClock(ref, 1000, CYCLE - 1);
  const step = tick % CYCLE;
  const decided = Math.min(PROPOSALS.length - 1, step);
  const statusOf = (i: number): Status =>
    i < decided ? (PROPOSALS[i]?.final ?? "proposed") : "proposed";
  const statuses = PROPOSALS.map((_, i) => statusOf(i));
  const count = (st: Status) => statuses.filter((x) => x === st).length;
  const ready = decided >= PROPOSALS.length - 1;

  return (
    <Figure
      figureRef={ref}
      active={active}
      index={index}
      caption="Banque de la semaine · 4e A"
      status="Semaine du 9 nov."
      tone="ember"
    >
      <div className="flex h-full flex-col gap-3 p-3.5 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 rounded-[9px] bg-foreground/[0.06] p-1">
            {(["proposed", "selected", "rejected"] as const).map((st) => (
              <span
                key={st}
                className={cn(
                  "rounded-[6px] px-2 py-1 font-mono text-[10.5px] font-semibold tracking-[0.04em] uppercase transition-colors duration-300",
                  st === "selected"
                    ? "bg-surface text-foreground shadow-[0_1px_0_rgb(0_0_0/0.06)]"
                    : "text-muted-foreground",
                )}
              >
                {LABEL[st]}{" "}
                <span className="tabular-nums text-foreground">
                  {count(st)}
                </span>
              </span>
            ))}
          </div>
          <span className="flex items-center gap-1.5 font-mono text-[10.5px] tracking-[0.04em] text-muted-foreground uppercase">
            <Sparkle size={12} weight="fill" className="text-[#c99400]" />
            Chaque proposition vérifiée par le calcul
          </span>
        </div>

        <ul className="flex flex-1 flex-col gap-1.5">
          {PROPOSALS.map((p, i) => {
            const st = statuses[i] ?? "proposed";
            const just = i === decided - 1 && !reduced;
            return (
              <li
                key={p.id}
                className={cn(
                  "flex items-center gap-3 rounded-[10px] border bg-surface px-3 py-2.5 transition-[opacity,border-color] duration-500",
                  st === "selected" &&
                    "border-[color-mix(in_srgb,var(--tone)_70%,transparent)]",
                  st === "rejected" && "border-[var(--tk-line)] opacity-45",
                  st === "proposed" && "border-[var(--tk-edge)]",
                  just && s.land,
                )}
              >
                <span
                  className={cn(
                    "grid size-5 shrink-0 place-items-center rounded-[6px] border transition-colors duration-300",
                    st === "selected" &&
                      "border-transparent bg-[var(--tone)] text-[#15160F]",
                    st === "rejected" &&
                      "border-[var(--tk-line)] text-muted-foreground",
                    st === "proposed" && "border-[var(--tk-rule)]",
                  )}
                >
                  {st === "selected" ? (
                    <Check size={12} weight="bold" />
                  ) : st === "rejected" ? (
                    <X size={11} weight="bold" />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block truncate text-[13px] font-semibold text-foreground",
                      st === "rejected" && "line-through",
                    )}
                  >
                    {p.title}
                  </span>
                  <span className="mt-0.5 block truncate font-mono text-[10.5px] text-muted-foreground">
                    {p.notion} · {p.source}
                  </span>
                </span>
                <span className="hidden font-mono text-[10.5px] text-muted-foreground min-[460px]:inline">
                  {p.level}
                </span>
                <TonePill
                  tone={st === "selected" ? "ember" : "neutral"}
                  className="w-[62px] justify-center"
                >
                  {LABEL[st]}
                </TonePill>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center justify-between gap-3 border-t border-[var(--tk-line)] pt-3">
          <span className="text-[12px] font-medium text-muted-foreground">
            Rien ne part aux élèves sans votre choix.
          </span>
          <span
            className={cn(
              "shrink-0 rounded-[8px] px-3 py-1.5 text-[12.5px] font-semibold transition-colors duration-500",
              ready
                ? "bg-[var(--tone)] text-[#15160F]"
                : "bg-foreground/[0.06] text-muted-foreground",
            )}
          >
            Donner en devoir ({count("selected")})
          </span>
        </div>
      </div>
    </Figure>
  );
}
