import { appLinks } from "../../lib/site";
import { Frame, Mono, SlantButton } from "../kit";
import { HeroChat } from "./hero-chat";

export function Hero() {
  return (
    <section
      id="accueil"
      className="on-dark relative px-2 pt-[84px] pb-2 sm:px-3"
    >
      <Frame
        cut={22}
        edge="rgb(255 255 255 / 0.14)"
        className="hero-field isolate overflow-hidden rounded-[20px] text-white"
      >
        <div aria-hidden="true" className="hero-grid absolute inset-0" />
        <div className="relative flex min-h-[max(calc(100svh-96px),640px)] flex-col px-5 pt-8 pb-6 sm:px-10 sm:pt-14 lg:px-14 lg:pb-12">
          <p className="inline-flex w-fit items-center gap-2.5 border border-brand/50 bg-white/[0.06] py-1.5 pr-3.5 pl-3 text-[12.5px] text-white/85 backdrop-blur-md">
            <span
              className="relative grid size-2 place-items-center"
              aria-hidden="true"
            >
              <span className="absolute inset-0 rounded-full bg-brand/50 motion-safe:animate-ping" />
              <span className="size-1.5 rounded-full bg-brand shadow-[0_0_8px_var(--brand)]" />
            </span>
            Essai gratuit, sans moyen de paiement
          </p>

          <h1 className="mt-6 max-w-[15ch] font-display text-[clamp(2.6rem,6.2vw,5.4rem)] leading-[0.98] font-light tracking-[-0.045em] text-balance sm:mt-8">
            Un prof particulier IA{" "}
            <span className="text-brand">dans chaque matière.</span>
          </h1>

          <div className="mt-auto grid gap-10 pt-12 lg:grid-cols-[auto_1fr] lg:items-end">
            <HeroChat />
            <div className="flex flex-col items-start gap-6 lg:items-end lg:text-right">
              <p className="max-w-[34rem] text-[17px] leading-relaxed font-medium text-white/90 text-pretty sm:text-[19px]">
                Il apprend à connaître votre enfant, adapte chaque exercice à sa
                façon d'apprendre et le fait trouver par lui-même. Vous voyez
                ses progrès, preuves à l'appui.
              </p>
              <SlantButton href={appLinks.signup}>
                Commencer l'essai gratuit
              </SlantButton>
              <Mono className="text-white/55 uppercase">
                Programmes officiels · Un abonnement par matière
              </Mono>
            </div>
          </div>
        </div>
      </Frame>
    </section>
  );
}
