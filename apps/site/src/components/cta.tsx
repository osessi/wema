import { appLinks } from "../lib/site";
import { Frame, SlantButton } from "./kit";

/** L'action principale du site : une seule par écran. */
export function PrimaryCta({
  label = "Commencer l'essai gratuit",
  href = appLinks.signup,
}: {
  label?: string;
  href?: string;
}) {
  return <SlantButton href={href}>{label}</SlantButton>;
}

/** Bloc de fin de page : une phrase, l'action principale, la connexion. */
export function ClosingCta({ title, text }: { title: string; text: string }) {
  return (
    <section className="on-dark relative px-2 pt-10 pb-2 sm:px-3">
      <Frame
        cut={22}
        edge="rgb(255 255 255 / 0.12)"
        className="hero-field isolate overflow-hidden rounded-[20px] text-white"
      >
        <div aria-hidden="true" className="hero-grid absolute inset-0" />
        <div className="relative mx-auto max-w-6xl px-5 py-20 sm:px-10 sm:py-24">
          <h2 className="max-w-[20ch] font-display text-[clamp(2rem,4.4vw,3.4rem)] leading-[1.04] font-light tracking-[-0.035em] text-balance">
            {title}
          </h2>
          <p className="mt-4 max-w-xl text-[17px] text-white/75">{text}</p>
          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-5">
            <PrimaryCta />
            <a
              href={appLinks.login}
              className="font-mono text-[12px] text-white/70 uppercase underline decoration-white/30 underline-offset-4 hover:text-white"
            >
              J'ai déjà un compte
            </a>
          </div>
        </div>
      </Frame>
    </section>
  );
}
