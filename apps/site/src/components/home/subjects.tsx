"use client";

import {
  Atom,
  BookOpenText,
  Globe,
  type Icon,
  Leaf,
  MathOperations,
  Translate,
} from "@phosphor-icons/react";
import { useId, useState } from "react";
import { cx, Frame, GlowTile, Mono, SectionHead } from "../kit";

type Subject = {
  name: string;
  tone: string;
  icon: Icon;
  open: boolean;
  ask: string;
  reply: string;
  formats: string[];
};

const SUBJECTS: readonly Subject[] = [
  {
    name: "Mathématiques",
    tone: "#ffe89a",
    icon: MathOperations,
    open: true,
    ask: "Je comprends rien aux fractions.",
    reply:
      "On part d'une pizza coupée en 8. Tu en manges 3 parts : quelle fraction de la pizza reste-t-il ?",
    formats: ["Schéma", "Manipulable", "Pas à pas"],
  },
  {
    name: "Physique-chimie",
    tone: "#ffc9b5",
    icon: Atom,
    open: false,
    ask: "Pourquoi la glace flotte sur l'eau ?",
    reply:
      "Bonne question. Que devient le volume de l'eau quand elle gèle ? Pense à la bouteille oubliée au congélateur.",
    formats: ["Expérience", "Schéma"],
  },
  {
    name: "SVT",
    tone: "#bfefd9",
    icon: Leaf,
    open: false,
    ask: "C'est quoi la photosynthèse ?",
    reply:
      "Avant de t'expliquer : d'après toi, d'où vient la matière d'un arbre ? Du sol, de l'eau ou de l'air ?",
    formats: ["Schéma", "Bande dessinée"],
  },
  {
    name: "Français",
    tone: "#f7c6d9",
    icon: BookOpenText,
    open: false,
    ask: "Je dois écrire une rédaction sur un souvenir.",
    reply:
      "Quel souvenir te vient en premier ? Raconte-le-moi en trois phrases, on construira le plan à partir de là.",
    formats: ["Lecture facile", "Audio"],
  },
  {
    name: "Anglais",
    tone: "#ddf59a",
    icon: Translate,
    open: false,
    ask: "Comment on dit « je suis allé » ?",
    reply:
      "Tu connais le verbe go. À ton avis, quelle forme prend-il quand l'action est finie ?",
    formats: ["Audio", "Dialogue"],
  },
  {
    name: "Histoire-géo",
    tone: "#ead9bf",
    icon: Globe,
    open: false,
    ask: "Pourquoi la Première Guerre mondiale a commencé ?",
    reply:
      "Regardons la carte de l'Europe en 1914. Quels pays se sont promis de s'aider ?",
    formats: ["Carte", "Frise"],
  },
];

export function Subjects() {
  const [index, setIndex] = useState(0);
  const base = useId();
  const subject = SUBJECTS[index] ?? SUBJECTS[0];
  if (!subject) return null;
  const SubjectIcon = subject.icon;

  return (
    <section id="matieres" className="relative px-4 py-24 sm:py-32">
      <SectionHead
        eyebrow="Les matières"
        lead="Un prof pour chaque matière,"
        follow="qui fait trouver."
        text="Chaque matière a son prof IA, qui suit le programme officiel de la classe de l'élève. Les mathématiques ouvrent en premier ; les autres matières arrivent une à une."
      />

      <div className="mx-auto mt-14 grid max-w-6xl gap-4 lg:grid-cols-[320px_1fr] [&>*]:min-w-0">
        <div
          role="tablist"
          aria-label="Matières"
          aria-orientation="vertical"
          className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1"
          onKeyDown={(e) => {
            const step =
              e.key === "ArrowDown" || e.key === "ArrowRight"
                ? 1
                : e.key === "ArrowUp" || e.key === "ArrowLeft"
                  ? -1
                  : 0;
            if (step === 0) return;
            e.preventDefault();
            const next = (index + step + SUBJECTS.length) % SUBJECTS.length;
            setIndex(next);
            document.getElementById(`${base}-tab-${next}`)?.focus();
          }}
        >
          {SUBJECTS.map((s, i) => {
            const TabIcon = s.icon;
            const selected = i === index;
            return (
              <button
                key={s.name}
                id={`${base}-tab-${i}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`${base}-panel`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setIndex(i)}
                className={cx(
                  "flex items-center gap-3 border px-3 py-3 text-left transition-colors",
                  selected
                    ? "border-ink bg-surface"
                    : "border-line bg-paper hover:border-line-strong hover:bg-surface",
                )}
              >
                <GlowTile tone={s.tone} size={36} className="rounded-[10px]">
                  <TabIcon size={18} weight="bold" />
                </GlowTile>
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-semibold">
                    {s.name}
                  </span>
                  <Mono className={s.open ? "text-mint-ink" : "text-ink-muted"}>
                    {s.open ? "Ouvert" : "Bientôt"}
                  </Mono>
                </span>
              </button>
            );
          })}
        </div>

        <Frame as="article" cut={18} className="bg-surface">
          <div
            id={`${base}-panel`}
            role="tabpanel"
            aria-labelledby={`${base}-tab-${index}`}
            className="flex h-full flex-col"
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <Mono className="text-ink-muted uppercase">
                Fig. 01 · Le prof de {subject.name.toLowerCase()}
              </Mono>
              <Mono
                className={cx(
                  "flex items-center gap-1.5 uppercase",
                  subject.open ? "text-mint-ink" : "text-ink-muted",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cx(
                    "size-1.5 rounded-full",
                    subject.open ? "bg-mint-ink" : "bg-line-strong",
                  )}
                />
                {subject.open ? "Disponible" : "En préparation"}
              </Mono>
            </div>

            <div className="figure-dots flex flex-1 flex-col gap-4 p-5 sm:p-8">
              <div className="flex items-center gap-3">
                <GlowTile tone={subject.tone} size={44}>
                  <SubjectIcon size={22} weight="bold" />
                </GlowTile>
                <p className="font-display text-2xl font-light tracking-tight">
                  {subject.name}
                </p>
              </div>
              <p
                key={`a-${subject.name}`}
                className="bubble-in max-w-[80%] self-end rounded-[14px_14px_4px_14px] bg-brand px-4 py-3 text-[15px] text-ink"
              >
                {subject.ask}
              </p>
              <p
                key={`r-${subject.name}`}
                className="bubble-in max-w-[86%] self-start rounded-[14px_14px_14px_4px] border border-line bg-paper px-4 py-3 text-[15px] leading-relaxed [animation-delay:.15s]"
              >
                {subject.reply}
              </p>
              <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-line pt-4">
                <Mono className="mr-1 text-ink-muted uppercase">
                  Ses formats
                </Mono>
                {subject.formats.map((format) => (
                  <span
                    key={format}
                    className="rounded-full px-2.5 py-1 text-[12.5px] font-semibold text-ink"
                    style={{ backgroundColor: subject.tone }}
                  >
                    {format}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Frame>
      </div>
    </section>
  );
}
