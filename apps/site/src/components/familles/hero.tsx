"use client";

import { type CSSProperties, useEffect, useRef } from "react";
import { WemaLogo } from "../../wa/components/site/wema-logo";
import SlantMorphButton from "../../wa/components/tweenui/slant-morph-button";
import { GradientField } from "../../wa/components/v2/hero/gradient-field";
import { HeroTitle } from "../../wa/components/v2/hero/hero-title";
import { signupHref } from "../../wa/config/site";

/** Fond : « 58 Colorful Smooth Gradient » (gradientshub.com, libre d'usage). */
const G = "/gradients/w58";

/**
 * Indique au menu du site que l'accroche est en haut de l'écran, comme
 * l'accroche de l'accueil (le menu se range alors en haut à droite).
 */
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

const PROMISES = [
  "Jamais la réponse",
  "Une matière à la fois",
  "Espace parent",
] as const;

export function FamilyHero() {
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
        <div className="tk-frame-cut relative isolate flex min-h-[max(calc(100svh-96px),600px)] flex-col overflow-hidden rounded-[20px] text-white sm:min-h-[max(calc(100svh-108px),560px)] lg:min-h-[max(calc(100svh-24px),640px)]">
          <GradientField
            src={`${G}-2400.webp`}
            srcSet={`${G}-1200.webp 1200w, ${G}-2400.webp 2400w`}
            softSrc={`${G}-600.webp`}
          />
          {/* Voile : la moitié claire du dégradé passe sous le texte blanc. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(75%_60%_at_50%_52%,rgb(10_12_24/0.52),rgb(10_12_24/0.18)_70%,transparent_100%)]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgb(10_12_24/0.25)_0%,transparent_30%,rgb(10_12_24/0.45)_100%)]"
          />

          <div className="relative px-5 pt-6 sm:px-10 sm:pt-12 lg:px-14 lg:pt-14">
            <WemaLogo className="hidden h-9 w-auto text-white lg:block" />
          </div>

          <div className="relative flex flex-1 flex-col items-center justify-center px-5 py-12 text-center sm:px-10">
            <div
              className="tk-frame inline-block"
              style={{ "--c": "7px", "--tk-edge": "#ffc529" } as CSSProperties}
            >
              <p className="tk-frame-cut relative inline-flex items-center gap-2.5 bg-white/[0.08] py-1.5 pr-3.5 pl-3 text-[12.5px] text-white/90 backdrop-blur-md">
                <span
                  className="relative grid size-2 place-items-center"
                  aria-hidden="true"
                >
                  <span className="absolute inset-0 rounded-full bg-[#ffc529]/50 motion-safe:animate-ping" />
                  <span className="size-1.5 rounded-full bg-[#ffc529] shadow-[0_0_8px_#ffc529]" />
                </span>
                <span className="font-medium">Pour les parents</span>
                <span aria-hidden="true" className="tk-frame-rim" />
              </p>
            </div>

            <HeroTitle
              className="mt-6 max-w-[17ch] text-[36px] leading-[1.05] font-light tracking-[-0.045em] text-balance sm:mt-8 sm:text-[clamp(44px,min(5vw,8.6svh),76px)] sm:leading-[1.02]"
              segments={[
                { text: "Votre enfant a un prof IA " },
                {
                  text: "là où il en a besoin,",
                  className: "text-[#ffe08a]",
                },
                { text: " et c'est lui qui trouve." },
              ]}
            />

            <p className="mt-6 max-w-[600px] text-[17px] leading-relaxed font-medium text-pretty text-white/90 sm:mt-8 sm:text-[20px]">
              Un prof particulier IA dans chaque matière qui lui pose problème.
              Il questionne, donne des indices, relance. Vous voyez ce qu'il a
              compris, preuves à l'appui.
            </p>

            <div className="mt-8 flex flex-col items-center gap-4 sm:mt-10">
              <SlantMorphButton href={signupHref}>
                Commencer l'essai gratuit
              </SlantMorphButton>
              <p className="font-mono text-[11.5px] tracking-[0.06em] text-white/75 uppercase">
                Sans moyen de paiement · premier entretien offert
              </p>
            </div>
          </div>

          <div className="relative px-5 pb-6 sm:px-10 sm:pb-10">
            <ul
              aria-label="Nos engagements"
              className="flex flex-wrap items-center justify-center gap-x-3.5 gap-y-2 font-mono text-[10.5px] tracking-[0.06em] text-white/65 uppercase"
            >
              {PROMISES.map((item, index) => (
                <li key={item} className="flex items-center gap-3.5">
                  {index > 0 ? (
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
          <span aria-hidden="true" className="tk-frame-rim" />
        </div>
      </div>
    </section>
  );
}
