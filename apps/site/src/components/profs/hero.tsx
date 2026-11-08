"use client";

import { ChalkboardTeacher, CheckCircle } from "@phosphor-icons/react";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { WemaLogo } from "../../wa/components/site/wema-logo";
import SlantMorphButton from "../../wa/components/tweenui/slant-morph-button";
import { GradientField } from "../../wa/components/v2/hero/gradient-field";
import { HeroTitle } from "../../wa/components/v2/hero/hero-title";
import { contactHref, signupHref } from "../../wa/config/site";
import { GlowTile } from "../../wa/ui/components/ui/glow-tile";
import { cn } from "../../wa/ui/lib/utils";

/** Fond : « 20 Colorful Smooth Gradient » (gradientshub.com, libre d'usage). */
const G = "/gradients/w20";

/** Indique au menu du site que l'accroche est en haut de l'écran, comme sur l'accueil. */
function useHeroFlags(frame: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = document.documentElement;
    let raf = 0;
    const update = () => {
      const el = frame.current;
      if (el === null) return;
      root.toggleAttribute(
        "data-hero-at-top",
        el.getBoundingClientRect().top > -40,
      );
    };
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      root.removeAttribute("data-hero-at-top");
    };
  }, [frame]);
}

/** Exemple : un devoir donné à une classe fictive, décliné puis suivi. */
const LEARNERS = [
  { name: "Inès", format: "Lecture facile", result: "A compris" },
  { name: "Kossi", format: "Étapes guidées", result: "Bloque : signe" },
  { name: "Léa", format: "Niveau +1", result: "A compris" },
  { name: "Malik", format: "Schéma", result: "En cours" },
] as const;

const PHASES = [
  "Exercice retenu",
  "Une variante par élève",
  "Suivi de la semaine",
] as const;
const PAUSE = 1500;
const CYCLE = LEARNERS.length * 2 + 4;

function HeroClassCard() {
  const [step, setStep] = useState(CYCLE - 1);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setStep(0);
    let n = 0;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      n = (n + 1) % CYCLE;
      setStep(n);
    }, PAUSE);
    return () => window.clearInterval(id);
  }, []);

  const variants = Math.min(LEARNERS.length, step);
  const results = Math.max(
    0,
    Math.min(LEARNERS.length, step - LEARNERS.length - 1),
  );
  const phase = results > 0 ? PHASES[2] : variants > 0 ? PHASES[1] : PHASES[0];

  return (
    <figure
      aria-label="Exemple : un exercice décliné pour quatre élèves, puis leur suivi"
      className="w-full max-w-[400px] border border-white/12 bg-[#100f0b]/70 text-left backdrop-blur-md"
    >
      <figcaption className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <GlowTile tone="gold" size={30} className="rounded-lg">
          <ChalkboardTeacher size={16} weight="bold" />
        </GlowTile>
        <span className="text-[13.5px] font-semibold text-white">
          4e A · Maths
          <span className="font-normal text-white/55"> · exemple</span>
        </span>
        <span className="ml-auto rounded-sm border border-[#ffc529]/40 px-1.5 py-0.5 font-mono text-[10.5px] tracking-[0.04em] text-[#ffc529] uppercase">
          {phase}
        </span>
      </figcaption>
      <div className="flex flex-col gap-2.5 p-4">
        <div className="border border-white/10 bg-white/[0.04] px-3 py-2.5">
          <span className="block font-mono text-[10px] tracking-[0.08em] text-white/55 uppercase">
            Votre choix
          </span>
          <span className="mt-0.5 block text-[14px] font-semibold text-white">
            Mettre un problème en équation
          </span>
        </div>
        <ul className="flex flex-col gap-1.5">
          {LEARNERS.map((l, i) => {
            const ready = i < variants;
            const shown = i < results;
            const blocked = l.result.startsWith("Bloque");
            return (
              <li
                key={l.name}
                className={cn(
                  "flex items-center gap-2.5 border px-3 py-2 transition-[opacity,border-color] duration-500",
                  ready
                    ? "border-white/12 opacity-100"
                    : "border-white/5 opacity-40",
                )}
              >
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white/10 text-[10.5px] font-semibold text-white/85">
                  {l.name.charAt(0)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-white">
                    {l.name}
                  </span>
                  <span className="block truncate font-mono text-[10.5px] text-white/55">
                    {ready ? l.format : "Variante en préparation"}
                  </span>
                </span>
                {shown ? (
                  <span
                    className={cn(
                      "shrink-0 rounded-sm px-1.5 py-0.5 font-mono text-[10.5px] font-semibold",
                      blocked
                        ? "bg-[#FF4D5E] text-white"
                        : l.result === "En cours"
                          ? "bg-white/12 text-white/85"
                          : "bg-[#ffc529] text-[#1a1403]",
                    )}
                  >
                    {l.result}
                  </span>
                ) : ready ? (
                  <CheckCircle
                    size={16}
                    weight="fill"
                    className="shrink-0 text-[#ffc529]"
                    aria-hidden="true"
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
        <p className="font-mono text-[10.5px] tracking-[0.04em] text-white/55 uppercase">
          Chaque variante vérifiée par le calcul
        </p>
      </div>
    </figure>
  );
}

export function ProfsHero() {
  const frame = useRef<HTMLDivElement>(null);
  useHeroFlags(frame);
  return (
    <section className="relative px-2 pt-[88px] pb-2 sm:px-3 sm:pt-[96px] sm:pb-3 lg:pt-3">
      <div
        ref={frame}
        id="top"
        className="tk-frame"
        style={
          {
            "--c": "22px",
            "--tk-edge": "rgb(255 255 255 / 0.14)",
          } as CSSProperties
        }
      >
        <div className="tk-frame-cut relative isolate flex min-h-[max(calc(100svh-96px),600px)] flex-col overflow-hidden rounded-[20px] text-white sm:min-h-[max(calc(100svh-108px),560px)] lg:min-h-[max(calc(100svh-24px),680px)]">
          <GradientField
            src={`${G}-2400.webp`}
            srcSet={`${G}-1200.webp 1200w, ${G}-2400.webp 2400w`}
            softSrc={`${G}-600.webp`}
            headVeil="dark"
            footVeil="dark"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgb(12_9_2/0.12)_0%,rgb(12_9_2/0.4)_55%,rgb(12_9_2/0.58)_100%)]"
          />

          <div className="relative px-5 pt-6 sm:px-10 sm:pt-12 lg:px-14 lg:pt-14">
            <WemaLogo className="mb-[clamp(32px,7svh,90px)] hidden h-9 w-auto text-white lg:block" />
            <div
              className="tk-frame inline-block"
              style={{ "--c": "7px", "--tk-edge": "#ffc529" } as CSSProperties}
            >
              <p className="tk-frame-cut relative inline-flex items-center gap-2.5 bg-white/[0.06] py-1.5 pr-3.5 pl-3 text-[12.5px] text-white/85 backdrop-blur-md">
                <span
                  className="relative grid size-2 place-items-center"
                  aria-hidden="true"
                >
                  <span className="absolute inset-0 rounded-full bg-[#ffc529]/50 motion-safe:animate-ping" />
                  <span className="size-1.5 rounded-full bg-[#ffc529] shadow-[0_0_8px_#ffc529]" />
                </span>
                <span className="font-medium">
                  Profs particuliers, écoles et réseaux
                </span>
                <span aria-hidden="true" className="tk-frame-rim" />
              </p>
            </div>
            <HeroTitle
              className="mt-4 max-w-[18ch] sm:max-w-[24ch] text-[34px] leading-[1.05] font-light tracking-[-0.045em] text-balance sm:mt-7 sm:text-[clamp(42px,min(4.5vw,8.6svh),70px)] sm:leading-[1.02]"
              segments={[
                { text: "Vous gardez la main. ", className: "sm:block" },
                {
                  text: "Wema adapte chaque exercice",
                  className: "text-[#ffe08a]",
                },
                { text: " à chaque élève." },
              ]}
            />
          </div>

          <div className="relative mt-auto flex flex-col-reverse gap-8 px-5 pt-8 pb-5 sm:px-10 sm:pb-10 lg:flex-row lg:items-end lg:justify-between lg:px-14 lg:pb-12">
            <div className="w-full max-w-[400px]">
              <HeroClassCard />
            </div>
            <div className="flex max-w-[540px] flex-col items-start gap-5 sm:gap-6 lg:items-end lg:text-right">
              <p className="text-[17px] leading-relaxed font-medium text-pretty text-white/95 sm:text-[20px] lg:text-balance">
                Chaque semaine, Wema vous propose des exercices sur le
                programme. Vous choisissez ou vous déposez les vôtres. Le prof
                IA les décline pour chaque élève et vous montre{" "}
                <span className="font-semibold text-[#ffe08a]">
                  qui a compris, qui bloque, et sur quoi.
                </span>
              </p>
              <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6 lg:flex-row-reverse">
                <SlantMorphButton href={signupHref}>
                  Ouvrir mon espace prof
                </SlantMorphButton>
                <a
                  href={contactHref}
                  className="tk-link text-[16px] font-medium !text-white"
                >
                  Parler à l'équipe
                </a>
              </div>
              <ul
                aria-label="Nos engagements"
                className="flex flex-wrap items-center gap-x-3.5 gap-y-2 font-mono text-[10.5px] tracking-[0.06em] text-white/65 uppercase lg:justify-end"
              >
                {[
                  "Rien n'est envoyé sans vous",
                  "Calculs vérifiés",
                  "Programmes officiels",
                ].map((item, i) => (
                  <li key={item} className="flex items-center gap-3.5">
                    {i > 0 ? (
                      <span
                        aria-hidden="true"
                        className="size-[4px] rotate-45 bg-white/35"
                      />
                    ) : null}
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <span aria-hidden="true" className="tk-frame-rim" />
        </div>
      </div>
    </section>
  );
}
