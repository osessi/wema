"use client";

import { CheckCircle, UploadSimple } from "@phosphor-icons/react/dist/ssr";
import { useRef } from "react";
import {
  Figure,
  TonePill,
  useFigureClock,
} from "../../wa/components/v2/journey/figure";
import s from "../../wa/components/v2/journey/journey.module.css";
import { cn } from "../../wa/ui/lib/utils";

/** Un exercice écrit par le prof : un modèle, des plages, puis le contrôle par le calcul. */
const TEMPLATE = "Résoudre {a}x + {b} = {c}";

const VARIANTS = [
  { level: "Niveau 1", equation: "3x + 4 = 19", answer: "x = 5" },
  { level: "Niveau 2", equation: "6x + 13 = 1", answer: "x = −2" },
  { level: "Niveau 3", equation: "4x + 9 = 3", answer: "x = −1,5" },
] as const;

const TYPE_STEPS = 5;
const CHECK_AT = TYPE_STEPS + 1;
const VALID_AT = CHECK_AT + 2;
const DEPOSIT_AT = VALID_AT + VARIANTS.length + 1;
const CYCLE = DEPOSIT_AT + 4;

function Field({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[10px] tracking-[0.08em] text-muted-foreground uppercase">
        {label}
      </span>
      <div className="rounded-[8px] border border-[var(--tk-edge)] bg-surface px-2.5 py-2 text-[12.5px] font-medium text-foreground">
        {children}
      </div>
    </div>
  );
}

export function FigureDeposit({ index }: { readonly index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const { step: tick, active, reduced } = useFigureClock(ref, 750, CYCLE - 1);
  const step = tick % CYCLE;
  const typed = Math.min(
    TEMPLATE.length,
    Math.round((Math.min(step, TYPE_STEPS) / TYPE_STEPS) * TEMPLATE.length),
  );
  const checking = step >= CHECK_AT && step < VALID_AT;
  const valid = step >= VALID_AT;
  const shownVariants = valid
    ? Math.min(VARIANTS.length, step - VALID_AT + 1)
    : 0;
  const deposited = step >= DEPOSIT_AT;

  return (
    <Figure
      figureRef={ref}
      active={active}
      index={index}
      caption="Nouvel exercice · vos propres énoncés"
      status={valid ? "Validé" : checking ? "Vérification" : "Brouillon"}
      tone="gold"
    >
      <div className="grid h-full gap-3 p-3.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:p-4">
        <div className="flex flex-col gap-2.5">
          <Field label="Notion évaluée">Équations du 1er degré</Field>
          <Field label="Idée fausse ciblée (facultatif)">
            Change mal le signe en passant un terme de l'autre côté
          </Field>
          <Field label="Énoncé">
            <span className="font-mono text-[12.5px]">
              {TEMPLATE.slice(0, typed)}
              {typed < TEMPLATE.length && !reduced ? (
                <span className={cn(s.caret, "ml-px text-[var(--tone)]")}>
                  |
                </span>
              ) : null}
            </span>
          </Field>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              ["a", "2 à 9"],
              ["b", "−20 à 20"],
              ["c", "−20 à 30"],
            ].map(([name, range]) => (
              <div
                key={name}
                className="rounded-[8px] border border-[var(--tk-line)] bg-surface px-2 py-1.5"
              >
                <span className="block font-mono text-[10px] text-muted-foreground">
                  {`{${name}}`}
                </span>
                <span className="block text-[11.5px] font-semibold text-foreground">
                  {range}
                </span>
              </div>
            ))}
          </div>
          <span
            className={cn(
              "mt-auto inline-flex items-center justify-center gap-2 rounded-[8px] px-3 py-2 text-[12.5px] font-semibold transition-colors duration-500",
              checking
                ? cn("text-foreground", !reduced && s.shimmer)
                : valid
                  ? "bg-foreground/[0.06] text-muted-foreground"
                  : "bg-[var(--tone)] text-[#15160F]",
            )}
          >
            {checking ? "Vérification par le calcul…" : "Vérifier et valider"}
          </span>
        </div>

        <div className="flex min-h-[180px] flex-col gap-2 rounded-[10px] border border-[var(--tk-edge)] bg-surface p-3">
          <span className="font-mono text-[10px] tracking-[0.08em] text-muted-foreground uppercase">
            Contrôle par le moteur de calcul
          </span>
          {valid ? (
            <p
              className={cn(
                "flex items-center gap-1.5 text-[12.5px] font-semibold text-foreground",
                !reduced && s.pop,
              )}
            >
              <CheckCircle
                size={16}
                weight="fill"
                className="shrink-0 text-[#c99400] dark:text-[var(--tone)]"
              />
              Une variante vérifiée par niveau
            </p>
          ) : (
            <p className="text-[12px] leading-snug text-muted-foreground">
              Wema tire des valeurs dans vos plages et vérifie chaque réponse
              avant que l'exercice puisse être donné.
            </p>
          )}
          <ul className="flex flex-col gap-1.5">
            {VARIANTS.slice(0, shownVariants).map((v) => (
              <li
                key={v.level}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-[8px] border border-[var(--tk-line)] px-2.5 py-2",
                  !reduced && s.pop,
                )}
              >
                <span className="min-w-0">
                  <span className="block font-mono text-[10px] text-muted-foreground uppercase">
                    {v.level}
                  </span>
                  <span className="block truncate font-mono text-[12.5px] font-semibold text-foreground">
                    {v.equation}
                  </span>
                </span>
                <TonePill tone="gold">{v.answer}</TonePill>
              </li>
            ))}
          </ul>
          {deposited ? (
            <div
              className={cn(
                "mt-auto flex items-center gap-2 rounded-[8px] bg-[var(--tone)] px-2.5 py-2 text-[12px] font-semibold text-[#15160F]",
                !reduced && s.pop,
              )}
            >
              <UploadSimple size={14} weight="bold" />
              Déposé dans la banque de la semaine
            </div>
          ) : null}
        </div>
      </div>
    </Figure>
  );
}
