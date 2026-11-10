"use client";

/**
 * Figures animées de la méthode, construites comme celles de Winner
 * (`wa/components/v2/journey/figure-*.tsx`) : cadre « Fig. 0X », horloge qui
 * ne tourne que lorsque la figure est visible, image fixe si l'animation est
 * réduite. Élève fictive : Inès, 4e.
 */

import {
  Bell,
  Camera,
  Check,
  CheckCircle,
  Circle,
  Lightbulb,
  Sparkle,
  VideoCamera,
} from "@phosphor-icons/react";
import { type CSSProperties, useRef } from "react";
import {
  Figure,
  type StepTone,
  TONE_HEX,
  TonePill,
  useFigureClock,
} from "../../wa/components/v2/journey/figure";
import s from "../../wa/components/v2/journey/journey.module.css";
import { cn } from "../../wa/ui/lib/utils";

function Initials({ text, tone }: { text: string; tone: StepTone }) {
  return (
    <span
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-[#15160F]"
      style={{ backgroundColor: TONE_HEX[tone] }}
    >
      {text}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Fig. 01 : le profil, chaque hypothèse avec sa source et sa preuve.  */
/* ------------------------------------------------------------------ */

const CLAIMS = [
  {
    claim: "Maîtrise les priorités de calcul",
    source: "Exercices",
    proof: "8 réussis sur 9",
    confidence: 88,
  },
  {
    claim: "Confond périmètre et aire",
    source: "Copie",
    proof: "3 erreurs du même type",
    confidence: 71,
  },
  {
    claim: "Réussit mieux avec un schéma",
    source: "Entretien",
    proof: "Comparé sur 12 exercices",
    confidence: 64,
  },
  {
    claim: "Se décourage après 20 minutes",
    source: "Parent",
    proof: "Déclaré, à confirmer",
    confidence: 40,
  },
] as const;

export function FigureProfile({ index }: { readonly index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const tone: StepTone = "gold";
  const cycle = CLAIMS.length + 6;
  const { step, active, reduced } = useFigureClock(ref, 900, cycle - 1);
  const t = step % cycle;
  const shown = Math.min(CLAIMS.length, t);
  const updated = t >= CLAIMS.length + 2;

  return (
    <Figure
      figureRef={ref}
      active={active}
      index={index}
      caption="Profil d'Inès · maths"
      status={updated ? "Mis à jour" : "En cours"}
      tone={tone}
    >
      <div className="flex h-full flex-col gap-3 p-3.5 sm:p-4">
        <div className="flex items-center gap-2.5 rounded-[12px] border border-[var(--tk-line)] bg-surface px-3 py-2.5">
          <Initials text="IN" tone={tone} />
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-semibold text-foreground">
              Inès · 4e
            </span>
            <span className="block truncate font-mono text-[10.5px] text-muted-foreground">
              Premier entretien · 12 min
            </span>
          </span>
          <span className="hidden gap-1 min-[420px]:flex">
            <TonePill tone="neutral">Élève</TonePill>
            <TonePill tone="neutral">Parent</TonePill>
            <TonePill tone="neutral">Prof</TonePill>
          </span>
        </div>

        <ul className="flex flex-1 flex-col gap-2">
          {CLAIMS.map((row, i) => {
            const on = i < shown;
            const pct = row.confidence + (updated && i === 1 ? 5 : 0);
            return (
              <li
                key={row.claim}
                className={cn(
                  "grid grid-cols-[minmax(0,1fr)_88px] items-center gap-3 rounded-[10px] border border-[var(--tk-line)] bg-surface px-3 py-2.5 transition-opacity duration-300",
                  on ? "opacity-100" : "opacity-30",
                  on && !reduced && i === shown - 1 && s.land,
                )}
                style={{ "--tone": TONE_HEX[tone] } as CSSProperties}
              >
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] font-semibold text-foreground">
                    {row.claim}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 truncate font-mono text-[10px] text-muted-foreground">
                    <span className="rounded-[4px] bg-foreground/[0.07] px-1 py-px text-foreground/70">
                      {row.source}
                    </span>
                    {row.proof}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block font-mono text-[11px] font-semibold text-foreground tabular-nums">
                    {on ? `${pct} %` : "··"}
                  </span>
                  <span className="mt-1 block h-1 overflow-hidden rounded-full bg-foreground/10">
                    <span
                      className="block h-full rounded-full transition-[width] duration-700 ease-out"
                      style={{
                        width: on ? `${pct}%` : "0%",
                        backgroundColor:
                          pct >= 60
                            ? TONE_HEX[tone]
                            : "color-mix(in srgb, var(--foreground) 35%, transparent)",
                      }}
                    />
                  </span>
                </span>
              </li>
            );
          })}
        </ul>

        <div
          className={cn(
            "flex items-center gap-2 rounded-[10px] px-3 py-2 text-[11.5px] font-semibold text-[#15160F] transition-opacity duration-300",
            updated ? "opacity-100" : "opacity-0",
            updated && !reduced && s.pop,
          )}
          style={{ backgroundColor: TONE_HEX[tone] }}
        >
          <Sparkle size={13} weight="fill" aria-hidden="true" />
          <span className="truncate">
            Nouvelle preuve : exercice d'aire réussi, confiance 71 → 76 %
          </span>
        </div>
        <p className="flex items-center justify-between gap-3 border-t border-[var(--tk-line)] pt-2.5 font-mono text-[10px] tracking-[0.08em] text-muted-foreground uppercase">
          <span>Aucune affirmation sans trace</span>
          <span className="hidden sm:inline">Jamais un diagnostic</span>
        </p>
      </div>
    </Figure>
  );
}

/* ------------------------------------------------------------------ */
/* Fig. 02 : une notion, trois variantes vérifiées.                    */
/* ------------------------------------------------------------------ */

const VARIANTS = [
  {
    name: "Standard",
    text: "Un rectangle mesure 7 cm sur 4 cm. Calcule son aire.",
    check: "7 × 4 = 28 cm²",
    easy: false,
  },
  {
    name: "Lecture facile",
    text: "Un rectangle. Longueur : 7 cm. Largeur : 4 cm. Quelle est son aire ?",
    check: "7 × 4 = 28 cm²",
    easy: true,
  },
  {
    name: "En contexte",
    text: "Le jardin de Kofi fait 9 m sur 6 m. Combien de m² de gazon faut-il ?",
    check: "9 × 6 = 54 m²",
    easy: false,
  },
] as const;

export function FigureVariants({ index }: { readonly index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const tone: StepTone = "emerald";
  const cycle = VARIANTS.length * 2 + 7;
  const { step, active, reduced } = useFigureClock(ref, 750, cycle - 1);
  const t = step % cycle;
  const served = t >= VARIANTS.length * 2 + 2;

  return (
    <Figure
      figureRef={ref}
      active={active}
      index={index}
      caption="Une notion, trois variantes"
      status={served ? "Servi" : "Vérification"}
      tone={tone}
    >
      <div className="flex h-full flex-col gap-3 p-3.5 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] tracking-[0.08em] text-muted-foreground uppercase">
            Notion évaluée
          </span>
          <TonePill tone={tone}>Aire du rectangle</TonePill>
          <TonePill tone="neutral">Programme 5e</TonePill>
        </div>

        <ol className="flex flex-1 flex-col justify-center gap-2">
          {VARIANTS.map((v, i) => {
            const shown = t >= i * 2;
            const verified = t >= i * 2 + 1;
            const chosen = served && i === 1;
            return (
              <li
                key={v.name}
                className={cn(
                  "rounded-[12px] border bg-surface px-3 py-2.5 transition-[opacity,box-shadow,border-color] duration-300",
                  shown ? "opacity-100" : "opacity-25",
                  chosen ? "" : "border-[var(--tk-line)]",
                )}
                style={
                  chosen
                    ? {
                        borderColor: TONE_HEX[tone],
                        boxShadow: `0 0 0 3px ${TONE_HEX[tone]}33`,
                      }
                    : undefined
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span className="inline-flex size-5 items-center justify-center rounded-[6px] border border-[var(--tk-edge)] font-mono text-[10px] font-semibold text-foreground/75">
                      {i + 1}
                    </span>
                    <span className="font-mono text-[10.5px] font-semibold tracking-[0.06em] text-foreground/80 uppercase">
                      {v.name}
                    </span>
                  </span>
                  {chosen ? (
                    <TonePill tone={tone} className={reduced ? "" : s.pop}>
                      Proposée à Inès
                    </TonePill>
                  ) : null}
                </div>
                <p
                  className={cn(
                    "mt-1.5 text-[12.5px] leading-snug text-foreground/85",
                    v.easy && "text-[13px] tracking-[0.02em]",
                  )}
                >
                  {v.text}
                </p>
                <div className="mt-2 flex items-center gap-2 font-mono text-[10.5px]">
                  {verified ? (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 text-foreground",
                        !reduced && s.pop,
                      )}
                    >
                      <CheckCircle
                        size={13}
                        weight="fill"
                        style={{ color: TONE_HEX[tone] }}
                        aria-hidden="true"
                      />
                      Moteur de calcul · {v.check}
                    </span>
                  ) : (
                    <span
                      className={cn(
                        "h-3 w-40 rounded-full",
                        shown && !reduced ? s.shimmer : "bg-foreground/[0.06]",
                      )}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        <p className="flex items-center justify-between gap-3 border-t border-[var(--tk-line)] pt-2.5 font-mono text-[10px] tracking-[0.08em] text-muted-foreground uppercase">
          <span>{Math.min(VARIANTS.length, Math.ceil(t / 2))}/3 vérifiées</span>
          <span className="hidden sm:inline">Même notion, autre forme</span>
        </p>
      </div>
    </Figure>
  );
}

/* ------------------------------------------------------------------ */
/* Fig. 03 : la copie photographiée, les erreurs repérées.             */
/* ------------------------------------------------------------------ */

const COPY_LINES = [
  { text: "Exercice 2", err: false, head: true },
  { text: "L = 7 cm   l = 4 cm", err: false },
  { text: "A = 2 × (7 + 4)", err: true },
  { text: "A = 22", err: true },
  { text: "Exercice 3", err: false, head: true },
  { text: "P = 2 × (5 + 3) = 16 cm", err: false },
] as const;

const FINDINGS = [
  {
    line: "Ligne 3",
    what: "L'aire calculée comme un périmètre",
    notion: "Aire du rectangle",
  },
  {
    line: "Ligne 4",
    what: "Unité oubliée : cm²",
    notion: "Unités d'aire",
  },
] as const;

export function FigureCopy({ index }: { readonly index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const tone: StepTone = "crimson";
  const cycle = 12;
  const { step, active, reduced } = useFigureClock(ref, 800, cycle - 1);
  const t = step % cycle;
  const scanning = t < 3 && !reduced;
  const marked = t >= 3;
  const found = Math.max(0, Math.min(FINDINGS.length, t - 3));
  const plan = t >= 6;

  return (
    <Figure
      figureRef={ref}
      active={active}
      index={index}
      caption="Contrôle du 14 novembre"
      status={marked ? "Relu" : "Lecture"}
      tone={tone}
    >
      <div className="grid h-full gap-3 p-3.5 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] sm:p-4">
        <div className="relative overflow-hidden rounded-[10px] border border-[var(--tk-edge)] bg-[#fbfaf4] p-3 text-[#23231d] shadow-[0_14px_30px_-22px_rgb(13_14_11/0.6)] [transform:rotate(-1.2deg)]">
          <div className="mb-2 flex items-center justify-between">
            <Camera size={14} aria-hidden="true" className="opacity-60" />
            <span
              className="rounded-[4px] px-1.5 py-0.5 font-mono text-[10px] font-bold"
              style={{
                backgroundColor: `${TONE_HEX[tone]}33`,
                color: "#a3121f",
              }}
            >
              11/20
            </span>
          </div>
          <ul className="space-y-1.5 font-[cursive] text-[13px] leading-tight">
            {COPY_LINES.map((line, i) => (
              <li
                key={line.text}
                className={cn(
                  "relative w-fit pr-1",
                  "head" in line && line.head && "font-bold underline",
                )}
              >
                <span className="mr-1.5 font-mono text-[9px] opacity-40">
                  {i + 1}
                </span>
                {line.text}
                {line.err && marked ? (
                  <span
                    className={cn(
                      "absolute -inset-x-1 -inset-y-0.5 rounded-[6px] border-2",
                      !reduced && s.pop,
                    )}
                    style={{ borderColor: TONE_HEX[tone] }}
                  />
                ) : null}
              </li>
            ))}
          </ul>
          {scanning ? (
            <span
              className="pointer-events-none absolute inset-x-0 h-8 bg-gradient-to-b from-transparent to-[#FF4D5E]/30 transition-[top] duration-700 ease-linear"
              style={{ top: `${(t / 3) * 100}%` }}
            />
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          {FINDINGS.map((f, i) => (
            <div
              key={f.line}
              className={cn(
                "rounded-[10px] border border-[var(--tk-line)] bg-surface px-3 py-2.5 transition-opacity duration-300",
                i < found ? "opacity-100" : "opacity-25",
                i < found && !reduced && i === found - 1 && s.pop,
              )}
            >
              <span
                className="font-mono text-[10px] font-semibold tracking-[0.06em] uppercase"
                style={{ color: TONE_HEX[tone] }}
              >
                {f.line}
              </span>
              <span className="block text-[12.5px] font-semibold text-foreground">
                {f.what}
              </span>
              <span className="mt-1 flex items-center gap-1.5 text-[11.5px] text-foreground/65">
                <Lightbulb size={12} weight="fill" aria-hidden="true" />À
                retravailler : {f.notion}
              </span>
            </div>
          ))}
          <div
            className={cn(
              "mt-auto rounded-[10px] p-3 text-[#15160F] transition-opacity duration-300",
              plan ? "opacity-100" : "opacity-0",
              plan && !reduced && s.pop,
            )}
            style={{ backgroundColor: TONE_HEX[tone] }}
          >
            <span className="block font-mono text-[9.5px] font-semibold tracking-[0.08em] uppercase opacity-75">
              Ce que le prof IA propose
            </span>
            <span className="mt-1 block text-[12px] font-semibold">
              2 exercices sur l'aire, puis une révision vendredi
            </span>
            <span className="mt-0.5 block text-[11px] font-medium opacity-80">
              Il fait refaire, il ne corrige pas à sa place
            </span>
          </div>
        </div>
      </div>
    </Figure>
  );
}

/* ------------------------------------------------------------------ */
/* Fig. 04 : relances et révisions espacées sur la semaine.            */
/* ------------------------------------------------------------------ */

const WEEK = [
  { day: "Lun", what: "Devoir du prof : aire", kind: "task" },
  { day: "Mar", what: "Exercice adapté, en schéma", kind: "task" },
  {
    day: "Mer",
    what: "Relance : « On termine l'exercice 3 ? »",
    kind: "nudge",
  },
  { day: "Jeu", what: "Séance visio avec son prof", kind: "visio" },
  { day: "Ven", what: "Révision : aire, vue il y a 4 jours", kind: "review" },
  { day: "Dim", what: "Résumé de la semaine au parent", kind: "report" },
] as const;

const REVIEWS = [
  { at: "J+1", x: 18 },
  { at: "J+4", x: 46 },
  { at: "J+10", x: 82 },
] as const;

export function FigureWeek({ index }: { readonly index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const tone: StepTone = "indigo";
  const cycle = WEEK.length + 5;
  const { step, active, reduced } = useFigureClock(ref, 850, cycle - 1);
  const t = step % cycle;
  const done = Math.min(WEEK.length, t);

  return (
    <Figure
      figureRef={ref}
      active={active}
      index={index}
      caption="Semaine 46 · Inès"
      status="En cours"
      tone={tone}
    >
      <div className="flex h-full flex-col gap-3 p-3.5 sm:p-4">
        <ol className="relative flex flex-col gap-1.5 before:absolute before:top-3 before:bottom-3 before:left-[47px] before:w-px before:bg-[var(--tk-rule)]">
          {WEEK.map((d, i) => {
            const on = i < done;
            const accent = d.kind === "nudge" || d.kind === "review";
            return (
              <li
                key={d.day}
                className="relative grid grid-cols-[34px_20px_minmax(0,1fr)] items-center gap-2"
              >
                <span className="font-mono text-[10.5px] tracking-[0.06em] text-muted-foreground uppercase">
                  {d.day}
                </span>
                <span className="relative z-10 grid place-items-center bg-surface">
                  {on ? (
                    <CheckCircle
                      size={18}
                      weight="fill"
                      style={{ color: TONE_HEX[tone] }}
                      className={reduced ? "" : s.pop}
                      aria-hidden="true"
                    />
                  ) : (
                    <Circle
                      size={18}
                      className="text-foreground/30"
                      aria-hidden="true"
                    />
                  )}
                </span>
                <span
                  className={cn(
                    "flex min-w-0 items-center gap-2 rounded-[8px] border px-2.5 py-1.5 text-[12px] transition-colors duration-300",
                    accent && on
                      ? "font-semibold text-[#15160F]"
                      : "border-[var(--tk-line)] bg-surface text-foreground/85",
                  )}
                  style={
                    accent && on
                      ? {
                          backgroundColor: TONE_HEX[tone],
                          borderColor: TONE_HEX[tone],
                        }
                      : undefined
                  }
                >
                  {d.kind === "nudge" ? (
                    <Bell size={12} weight="fill" aria-hidden="true" />
                  ) : d.kind === "visio" ? (
                    <VideoCamera size={12} weight="fill" aria-hidden="true" />
                  ) : d.kind === "review" ? (
                    <Check size={12} weight="bold" aria-hidden="true" />
                  ) : null}
                  <span className="truncate">{d.what}</span>
                </span>
              </li>
            );
          })}
        </ol>

        <div className="mt-auto rounded-[12px] border border-[var(--tk-line)] bg-surface p-3">
          <div className="flex items-center justify-between gap-2 font-mono text-[10px] tracking-[0.08em] text-muted-foreground uppercase">
            <span>Révisions espacées · aire</span>
            <span>Mémoire</span>
          </div>
          <svg
            viewBox="0 0 100 34"
            className="mt-1 h-[58px] w-full"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d="M0 4 C 8 16, 14 22, 18 24 L18 6 C 28 14, 38 18, 46 20 L46 5 C 60 10, 74 14, 82 15 L82 4 C 90 7, 96 9, 100 10"
              fill="none"
              stroke={TONE_HEX[tone]}
              strokeWidth="1.4"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <div className="relative h-5">
            {REVIEWS.map((r, i) => {
              const on = t >= 2 + i * 2;
              return (
                <span
                  key={r.at}
                  className={cn(
                    "absolute -translate-x-1/2 rounded-full px-1.5 py-[2px] font-mono text-[9.5px] font-semibold transition-colors duration-300",
                    on
                      ? "text-[#15160F]"
                      : "bg-foreground/[0.08] text-foreground/60",
                  )}
                  style={{
                    left: `${r.x}%`,
                    ...(on ? { backgroundColor: TONE_HEX[tone] } : {}),
                  }}
                >
                  {r.at}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </Figure>
  );
}
