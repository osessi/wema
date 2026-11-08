"use client";

import { CheckCircle, Lightbulb } from "@phosphor-icons/react";
import { type ComponentProps, Fragment, useId, useRef, useState } from "react";
import { GlowIcon } from "../../wa/components/v2/glow-icon";
import {
  Figure,
  TONE_HEX,
  TonePill,
  ToneWord,
  useFigureClock,
} from "../../wa/components/v2/journey/figure";
import s from "../../wa/components/v2/journey/journey.module.css";
import { Frame, SectionHeading } from "../../wa/components/v2/primitives";
import type { GlowTone } from "../../wa/ui/components/ui/glow-tile";
import { cn } from "../../wa/ui/lib/utils";
import {
  AtomIcon,
  BookIcon,
  GlobeSubjectIcon,
  LeafIcon,
  MathIcon,
  TranslateIcon,
} from "./icons";

type Turn = {
  from: "eleve" | "prof";
  text: string;
  /** Indice affiché pour une réplique du prof. */
  hint?: string;
  verified?: string;
};

type Subject = {
  name: string;
  short: string;
  tone: GlowTone;
  icon: ComponentProps<typeof GlowIcon>["icon"];
  open: boolean;
  notion: string;
  turns: readonly Turn[];
  formats: readonly string[];
};

const SUBJECTS: readonly Subject[] = [
  {
    name: "Mathématiques",
    short: "maths",
    tone: "gold",
    icon: MathIcon,
    open: true,
    notion: "Fractions · 5e",
    turns: [
      {
        from: "eleve",
        text: "Je comprends rien aux fractions. C'est quoi 3/8 + 1/4 ?",
      },
      {
        from: "prof",
        hint: "Indice 1 sur 3",
        text: "On ne peut additionner que des parts de même taille. Un quart, c'est combien de huitièmes ?",
      },
      { from: "eleve", text: "Deux huitièmes ? Donc 1/4 = 2/8." },
      {
        from: "prof",
        hint: "Indice 2 sur 3",
        text: "Exactement. Maintenant tu as 3/8 + 2/8 : que fais-tu des numérateurs ?",
      },
      { from: "eleve", text: "Je les ajoute : 5/8 !" },
      {
        from: "prof",
        text: "C'est toi qui l'as trouvé. Je vérifie avec le moteur de calcul.",
        verified: "3/8 + 1/4 = 5/8",
      },
    ],
    formats: ["Schéma", "Pas à pas", "Lecture facile", "Audio"],
  },
  {
    name: "Physique-chimie",
    short: "physique-chimie",
    tone: "ember",
    icon: AtomIcon,
    open: false,
    notion: "États de la matière · 5e",
    turns: [
      { from: "eleve", text: "Pourquoi la glace flotte sur l'eau ?" },
      {
        from: "prof",
        hint: "Indice 1 sur 3",
        text: "Que devient une bouteille d'eau pleine oubliée au congélateur ?",
      },
      { from: "eleve", text: "Elle gonfle, parfois elle éclate." },
      {
        from: "prof",
        hint: "Indice 2 sur 3",
        text: "Donc, à masse égale, la glace prend plus ou moins de place que l'eau ?",
      },
    ],
    formats: ["Expérience", "Schéma", "Vidéo courte"],
  },
  {
    name: "SVT",
    short: "SVT",
    tone: "emerald",
    icon: LeafIcon,
    open: false,
    notion: "Photosynthèse · 6e",
    turns: [
      { from: "eleve", text: "C'est quoi la photosynthèse ?" },
      {
        from: "prof",
        hint: "Indice 1 sur 3",
        text: "D'après toi, d'où vient la matière d'un arbre : du sol, de l'eau ou de l'air ?",
      },
      { from: "eleve", text: "Du sol, non ?" },
      {
        from: "prof",
        hint: "Indice 2 sur 3",
        text: "Si c'était le sol, le pot d'une plante qui grandit se viderait. Que se passe-t-il vraiment ?",
      },
    ],
    formats: ["Schéma", "Bande dessinée"],
  },
  {
    name: "Français",
    short: "français",
    tone: "crimson",
    icon: BookIcon,
    open: false,
    notion: "Récit · 4e",
    turns: [
      { from: "eleve", text: "Je dois écrire une rédaction sur un souvenir." },
      {
        from: "prof",
        hint: "Indice 1 sur 3",
        text: "Quel souvenir te vient en premier ? Raconte-le en trois phrases.",
      },
      { from: "eleve", text: "Le jour où j'ai appris à nager avec mon oncle." },
      {
        from: "prof",
        hint: "Indice 2 sur 3",
        text: "Bien. Qu'as-tu ressenti juste avant d'entrer dans l'eau ? Ce sera ton début.",
      },
    ],
    formats: ["Lecture facile", "Audio", "Plan guidé"],
  },
  {
    name: "Anglais",
    short: "anglais",
    tone: "indigo",
    icon: TranslateIcon,
    open: false,
    notion: "Prétérit · 4e",
    turns: [
      { from: "eleve", text: "Comment on dit « je suis allé » ?" },
      {
        from: "prof",
        hint: "Indice 1 sur 3",
        text: "Tu connais le verbe go. Quelle forme prend-il quand l'action est finie ?",
      },
      { from: "eleve", text: "Goed ?" },
      {
        from: "prof",
        hint: "Indice 2 sur 3",
        text: "Bonne logique, mais go est irrégulier. Tu l'as vu dans la liste : il commence par w.",
      },
    ],
    formats: ["Audio", "Dialogue", "Flashcards"],
  },
  {
    name: "Histoire-géo",
    short: "histoire-géo",
    tone: "orchid",
    icon: GlobeSubjectIcon,
    open: false,
    notion: "Première Guerre mondiale · 3e",
    turns: [
      {
        from: "eleve",
        text: "Pourquoi la Première Guerre mondiale a commencé ?",
      },
      {
        from: "prof",
        hint: "Indice 1 sur 3",
        text: "Regardons la carte de l'Europe en 1914. Quels pays se sont promis de s'aider ?",
      },
      { from: "eleve", text: "La France, la Russie et le Royaume-Uni ?" },
      {
        from: "prof",
        hint: "Indice 2 sur 3",
        text: "Oui, la Triple-Entente. Et en face ? Que se passe-t-il quand l'un d'eux est attaqué ?",
      },
    ],
    formats: ["Carte", "Frise", "Document"],
  },
];

function SubjectFigure({ subject }: { subject: Subject }) {
  const ref = useRef<HTMLDivElement>(null);
  const total = subject.turns.length;
  const cycle = total + 4;
  const { step, active, reduced } = useFigureClock(ref, 1500, cycle - 1);
  const shown = reduced ? total : Math.min(total, (step % cycle) + 1);
  const lastHint = subject.turns
    .slice(0, shown)
    .reduce<string | undefined>((acc, t) => t.hint ?? acc, undefined);
  const done = subject.turns[shown - 1]?.verified !== undefined;

  return (
    <Figure
      figureRef={ref}
      active={active}
      index={0}
      caption={`Le prof de ${subject.short}`}
      status={subject.open ? "Ouvert" : "Bientôt"}
      tone={subject.tone}
      decorative={false}
      className="min-h-[520px]"
    >
      <div className="flex h-full flex-col gap-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <GlowIcon tone={subject.tone} icon={subject.icon} size={44} />
          <span className="min-w-0 flex-1">
            <span className="block text-[17px] font-semibold tracking-[-0.01em] text-foreground">
              {subject.name}
            </span>
            <span className="block font-mono text-[11px] tracking-[0.06em] text-muted-foreground uppercase">
              {subject.notion} · {subject.open ? "Exemple" : "Aperçu"}
            </span>
          </span>
          <span className="flex gap-1.5">
            <TonePill tone="neutral">France</TonePill>
            <TonePill tone="neutral">Bénin</TonePill>
          </span>
        </div>

        <ol
          aria-label={`Exemple d'échange en ${subject.short}`}
          className="flex flex-1 flex-col justify-end gap-2.5"
        >
          {subject.turns.map((turn, i) => {
            const visible = i < shown;
            return (
              <li
                key={turn.text}
                className={cn(
                  "flex flex-col",
                  turn.from === "eleve" ? "items-end" : "items-start",
                  !visible && "sr-only",
                  visible && !reduced && i === shown - 1 && s.pop,
                )}
              >
                {turn.hint === undefined ? null : (
                  <span className="mb-1 inline-flex items-center gap-1 font-mono text-[10.5px] tracking-[0.06em] text-muted-foreground uppercase">
                    <Lightbulb size={12} weight="fill" aria-hidden="true" />
                    {turn.hint}
                  </span>
                )}
                <p
                  className={cn(
                    "max-w-[86%] px-3.5 py-2.5 text-[14.5px] leading-relaxed",
                    turn.from === "eleve"
                      ? "rounded-[14px_14px_4px_14px] text-[#15160F]"
                      : "rounded-[14px_14px_14px_4px] border border-[var(--tk-line)] bg-surface text-foreground",
                  )}
                  style={
                    turn.from === "eleve"
                      ? { backgroundColor: TONE_HEX[subject.tone] }
                      : undefined
                  }
                >
                  <span className="sr-only">
                    {turn.from === "eleve" ? "L'élève : " : "Le prof IA : "}
                  </span>
                  {turn.text}
                </p>
                {turn.verified === undefined ? null : (
                  <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-[var(--tk-line)] bg-surface px-2.5 py-1 font-mono text-[11px] text-foreground">
                    <CheckCircle
                      size={13}
                      weight="fill"
                      className="text-brand-active dark:text-brand"
                      aria-hidden="true"
                    />
                    Moteur de calcul · {turn.verified}
                  </span>
                )}
              </li>
            );
          })}
        </ol>

        <div className="grid gap-3 border-t border-[var(--tk-line)] pt-3 sm:grid-cols-[auto_1fr] sm:items-center">
          <span className="flex items-center gap-2 font-mono text-[10.5px] tracking-[0.06em] text-muted-foreground uppercase">
            <span className="flex gap-1" aria-hidden="true">
              {[1, 2, 3].map((n) => (
                <span
                  key={n}
                  className="h-1.5 w-5 rounded-full"
                  style={{
                    backgroundColor:
                      lastHint !== undefined &&
                      Number(lastHint.split(" ")[1]) >= n
                        ? TONE_HEX[subject.tone]
                        : "color-mix(in srgb, var(--foreground) 12%, transparent)",
                  }}
                />
              ))}
            </span>
            {done ? "Trouvé par l'élève" : (lastHint ?? "Question posée")}
          </span>
          <span className="flex flex-wrap items-center gap-1.5 sm:justify-end">
            <span className="mr-1 font-mono text-[10.5px] tracking-[0.06em] text-muted-foreground uppercase">
              Formats
            </span>
            {subject.formats.map((format) => (
              <TonePill key={format} tone={subject.tone}>
                {format}
              </TonePill>
            ))}
          </span>
        </div>
      </div>
    </Figure>
  );
}

export function Subjects() {
  const [index, setIndex] = useState(0);
  const base = useId();
  const subject = SUBJECTS[index] ?? SUBJECTS[0];
  if (subject === undefined) return null;

  return (
    <section
      id="matieres"
      aria-labelledby="matieres-title"
      className="relative scroll-mt-28 px-5 py-24 sm:px-8 sm:py-32"
    >
      <div className="mx-auto w-full max-w-[1160px]">
        <SectionHeading
          id="matieres-title"
          eyebrow="Les matières"
          title={[
            "Un prof pour chaque matière,",
            <Fragment key="accent">
              <ToneWord tone="brand">qui suit son programme.</ToneWord>
            </Fragment>,
          ]}
          sub="Chaque matière a son prof IA, qui suit le programme officiel de la classe de l'élève. Les mathématiques ouvrent en premier ; les autres matières arrivent une à une."
        />

        <div className="mt-14 grid gap-4 lg:mt-16 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-4">
            <div
              role="tablist"
              aria-label="Matières"
              aria-orientation="vertical"
              className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1"
              onKeyDown={(e) => {
                const delta =
                  e.key === "ArrowDown" || e.key === "ArrowRight"
                    ? 1
                    : e.key === "ArrowUp" || e.key === "ArrowLeft"
                      ? -1
                      : 0;
                if (delta === 0) return;
                e.preventDefault();
                const next =
                  (index + delta + SUBJECTS.length) % SUBJECTS.length;
                setIndex(next);
                document.getElementById(`${base}-tab-${next}`)?.focus();
              }}
            >
              {SUBJECTS.map((item, i) => {
                const selected = i === index;
                return (
                  <button
                    key={item.name}
                    id={`${base}-tab-${i}`}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-controls={`${base}-panel`}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => setIndex(i)}
                    className={cn(
                      "flex items-center gap-3 rounded-[14px] border px-3 py-2.5 text-left transition-colors outline-none focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--brand)_45%,transparent)]",
                      selected
                        ? "border-[var(--tk-rule)] bg-surface"
                        : "border-[var(--tk-line)] hover:bg-foreground/[0.04]",
                    )}
                  >
                    <GlowIcon tone={item.tone} icon={item.icon} size={38} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold text-foreground">
                        {item.name}
                      </span>
                      <span
                        className={cn(
                          "font-mono text-[11px] tracking-[0.06em] uppercase",
                          item.open
                            ? "text-brand-active dark:text-brand"
                            : "text-muted-foreground",
                        )}
                      >
                        {item.open ? "Ouvert" : "Bientôt"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <Frame className="hidden lg:block" innerClassName="p-5">
              <p className="font-mono text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
                Pour chaque matière
              </p>
              <ul className="mt-3 space-y-2 text-[14px] leading-snug text-foreground/80">
                <li>Le programme officiel de sa classe.</li>
                <li>Des indices progressifs, jamais la réponse.</li>
                <li>Le format qui l'aide : schéma, audio, lecture facile.</li>
              </ul>
            </Frame>
          </div>

          <Frame innerClassName="p-2 sm:p-3">
            <div
              id={`${base}-panel`}
              role="tabpanel"
              aria-labelledby={`${base}-tab-${index}`}
              className="h-full"
            >
              <SubjectFigure key={subject.name} subject={subject} />
            </div>
          </Frame>
        </div>
      </div>
    </section>
  );
}
