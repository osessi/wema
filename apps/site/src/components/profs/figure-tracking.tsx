"use client";

import { WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { useRef } from "react";
import {
  Figure,
  TonePill,
  useFigureClock,
} from "../../wa/components/v2/journey/figure";
import s from "../../wa/components/v2/journey/journey.module.css";
import { cn } from "../../wa/ui/lib/utils";

type St = 0 | 1 | 2 | 3;

const STATUS: readonly { readonly label: string; readonly cls: string }[] = [
  { label: "Non vue", cls: "bg-foreground/[0.06]" },
  {
    label: "À travailler",
    cls: "bg-[color-mix(in_srgb,#FF4D5E_55%,var(--surface))]",
  },
  {
    label: "En cours",
    cls: "bg-[color-mix(in_srgb,#5B7CFF_45%,var(--surface))]",
  },
  { label: "Validé", cls: "bg-[#ffc529]" },
];

const NOTIONS = [
  "Calcul littéral",
  "Équations",
  "Mise en équation",
  "Proportionnalité",
  "Puissances",
] as const;

/** Classe fictive : état de départ, puis état après la semaine. */
const ROWS: readonly {
  readonly name: string;
  readonly before: readonly St[];
  readonly after: readonly St[];
}[] = [
  { name: "Inès", before: [3, 2, 0, 3, 0], after: [3, 3, 2, 3, 0] },
  { name: "Kossi", before: [2, 1, 0, 3, 0], after: [3, 1, 1, 3, 0] },
  { name: "Léa", before: [3, 3, 2, 3, 2], after: [3, 3, 3, 3, 2] },
  { name: "Malik", before: [2, 2, 0, 2, 0], after: [3, 2, 2, 3, 0] },
  { name: "Awa", before: [3, 1, 0, 3, 0], after: [3, 1, 1, 3, 0] },
  { name: "Tom", before: [3, 2, 0, 2, 0], after: [3, 3, 2, 3, 0] },
];

const CELLS = ROWS.length;
const CYCLE = CELLS + 7;

export function FigureTracking({ index }: { readonly index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const { step: tick, active, reduced } = useFigureClock(ref, 800, CYCLE - 1);
  const step = tick % CYCLE;
  const updated = Math.min(CELLS, step);
  const grid = ROWS.map((r, i) => (i < updated ? r.after : r.before));
  const blocked = grid.filter((r) => r[1] === 1).length;
  const focus = 1;
  const validatedFocus = grid.filter((r) => r[focus] === 3).length;
  const done = updated >= CELLS;

  return (
    <Figure
      figureRef={ref}
      active={active}
      index={index}
      caption="Carte de la classe · 4e A"
      status={
        blocked === 0
          ? "Personne ne bloque"
          : `${blocked} élève${blocked > 1 ? "s" : ""} bloque${blocked > 1 ? "nt" : ""}`
      }
      tone="crimson"
    >
      <div className="flex h-full flex-col gap-3 p-3.5 sm:p-4">
        <div className="overflow-hidden rounded-[10px] border border-[var(--tk-edge)] bg-surface">
          <div className="grid grid-cols-[64px_repeat(5,minmax(0,1fr))] border-b border-[var(--tk-line)]">
            <span className="px-2 py-1.5 font-mono text-[9.5px] text-muted-foreground uppercase">
              Élève
            </span>
            {NOTIONS.map((n, i) => (
              <span
                key={n}
                title={n}
                className={cn(
                  "truncate px-1 py-1.5 text-center font-mono text-[9.5px] tracking-[0.02em] uppercase",
                  i === focus
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {n}
              </span>
            ))}
          </div>
          {ROWS.map((r, ri) => (
            <div
              key={r.name}
              className="grid grid-cols-[64px_repeat(5,minmax(0,1fr))] items-center border-b border-[var(--tk-line)] last:border-b-0"
            >
              <span className="truncate px-2 py-2 text-[12px] font-semibold text-foreground">
                {r.name}
              </span>
              {(grid[ri] ?? r.before).map((st, ci) => {
                const changed = ri === updated - 1 && st !== r.before[ci];
                return (
                  <span
                    key={NOTIONS[ci]}
                    className={cn(
                      "relative h-7 border-l border-[var(--tk-line)] p-[3px]",
                      ci === focus &&
                        "bg-[color-mix(in_srgb,var(--tone)_7%,transparent)]",
                    )}
                  >
                    <span
                      className={cn(
                        "block h-full rounded-[3px] transition-colors duration-500",
                        STATUS[st]?.cls,
                        changed && !reduced && s.pop,
                      )}
                    />
                  </span>
                );
              })}
            </div>
          ))}
        </div>

        <ul className="flex flex-wrap gap-x-3 gap-y-1">
          {STATUS.map((st) => (
            <li
              key={st.label}
              className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground uppercase"
            >
              <span className={cn("size-2.5 rounded-[3px]", st.cls)} />
              {st.label}
            </li>
          ))}
        </ul>

        <div className="mt-auto grid gap-2 min-[480px]:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="rounded-[10px] border border-[var(--tk-edge)] bg-surface p-2.5">
            <span className="block font-mono text-[10px] tracking-[0.06em] text-muted-foreground uppercase">
              Équations
            </span>
            <span className="mt-1 block text-[13px] font-semibold text-foreground">
              <span className="tabular-nums">{validatedFocus}</span> élèves sur{" "}
              {ROWS.length} ont validé cette notion
            </span>
          </div>
          <div
            className={cn(
              "rounded-[10px] border p-2.5 transition-colors duration-500",
              done
                ? "border-[color-mix(in_srgb,var(--tone)_55%,transparent)] bg-[color-mix(in_srgb,var(--tone)_8%,var(--surface))]"
                : "border-[var(--tk-edge)] bg-surface",
            )}
          >
            <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.06em] text-muted-foreground uppercase">
              <WarningCircle
                size={12}
                weight="fill"
                className="text-[var(--tone)]"
              />
              Idée fausse fréquente
            </span>
            <span className="mt-1 block text-[12.5px] leading-snug font-semibold text-foreground">
              Passe un terme de l'autre côté sans changer son signe
            </span>
            <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <TonePill tone="neutral">
                {blocked} élève{blocked > 1 ? "s" : ""} concerné
                {blocked > 1 ? "s" : ""}
              </TonePill>
              {done ? (
                <TonePill tone="crimson" className={cn(!reduced && s.pop)}>
                  À travailler collectivement
                </TonePill>
              ) : null}
            </span>
          </div>
        </div>
      </div>
    </Figure>
  );
}
