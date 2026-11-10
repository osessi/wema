"use client";

import { CheckCircle, MathOperations } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { cx, GlowTile, Mono } from "../kit";

type Line = {
  from: "eleve" | "prof";
  text: string;
  /** Étape affichée en haut de la carte quand cette ligne apparaît. */
  step: string;
  verified?: boolean;
};

/** Une vraie façon de faire : le prof IA fait trouver, il ne donne pas. */
const LINES: readonly Line[] = [
  {
    from: "eleve",
    text: "C'est quoi la réponse de 3x + 5 = 20 ?",
    step: "Question",
  },
  {
    from: "prof",
    text: "Je ne te la donne pas, on la trouve ensemble. Que peux-tu enlever des deux côtés pour garder 3x tout seul ?",
    step: "Indice 1 sur 3",
  },
  { from: "eleve", text: "Le 5 ? Ça fait 3x = 15.", step: "Indice 1 sur 3" },
  {
    from: "prof",
    text: "Exactement. Et pour passer de 3x à x ?",
    step: "Indice 2 sur 3",
  },
  { from: "eleve", text: "Je divise par 3 : x = 5 !", step: "Indice 2 sur 3" },
  {
    from: "prof",
    text: "C'est toi qui l'as trouvé. On vérifie : 3 × 5 + 5 = 20.",
    step: "Trouvé par l'élève",
    verified: true,
  },
];

const PAUSE = 1900;

export function HeroChat() {
  const [shown, setShown] = useState(LINES.length);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setShown(1);
    let count = 1;
    const id = window.setInterval(() => {
      count = count >= LINES.length + 2 ? 1 : count + 1;
      setShown(Math.min(count, LINES.length));
    }, PAUSE);
    return () => window.clearInterval(id);
  }, []);

  const visible = LINES.slice(0, shown);
  const step = visible.at(-1)?.step ?? "";
  const next = LINES[shown];

  return (
    <figure
      aria-label="Exemple de conversation avec le prof IA de maths"
      className="w-full max-w-[400px] border border-white/12 bg-[#100f0b]/70 text-left backdrop-blur-md"
    >
      <figcaption className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <GlowTile tone="#ffe89a" size={30} className="rounded-lg">
          <MathOperations size={16} weight="bold" />
        </GlowTile>
        <span className="text-[13.5px] font-semibold text-white">
          Prof de maths
          <span className="font-normal text-white/55"> · 4e</span>
        </span>
        <Mono className="ml-auto rounded-sm border border-brand/40 px-1.5 py-0.5 text-brand">
          {step}
        </Mono>
      </figcaption>
      <ol className="flex h-[300px] flex-col justify-end gap-2.5 overflow-hidden p-4 [mask-image:linear-gradient(180deg,transparent,#000_22%)]">
        {visible.map((line) => (
          <li
            key={line.text}
            className={cx(
              "bubble-in max-w-[86%] px-3.5 py-2.5 text-[14px] leading-snug",
              line.from === "eleve"
                ? "self-end rounded-[14px_14px_4px_14px] bg-brand text-ink"
                : "self-start rounded-[14px_14px_14px_4px] bg-white/[0.08] text-white/90",
            )}
          >
            {line.text}
            {line.verified ? (
              <span className="mt-2 flex items-center gap-1.5 font-mono text-[10.5px] text-[#9fe3c4]">
                <CheckCircle size={13} weight="fill" aria-hidden="true" />
                Calcul vérifié par le moteur de calcul
              </span>
            ) : null}
          </li>
        ))}
        {next?.from === "prof" ? (
          <li
            aria-hidden="true"
            className="flex gap-1 self-start rounded-full bg-white/[0.08] px-3 py-2.5"
          >
            <span className="typing-dot size-1.5 rounded-full bg-white/60" />
            <span className="typing-dot size-1.5 rounded-full bg-white/60 [animation-delay:.2s]" />
            <span className="typing-dot size-1.5 rounded-full bg-white/60 [animation-delay:.4s]" />
          </li>
        ) : null}
      </ol>
    </figure>
  );
}
