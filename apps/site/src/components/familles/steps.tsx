import type { Icon } from "@phosphor-icons/react";
import {
  BookOpenText,
  ChartLineUp,
  ChatsCircle,
  UserCirclePlus,
  UserPlus,
} from "@phosphor-icons/react/ssr";
import { Frame, SectionHeading } from "../../wa/components/v2/primitives";
import { TsfCta } from "../../wa/components/v2/tsf/tsf-cta";
import { signupHref } from "../../wa/config/site";
import { GlowTile, type GlowTone } from "../../wa/ui/components/ui/glow-tile";

const STEPS: readonly {
  icon: Icon;
  tone: GlowTone;
  who: string;
  title: string;
  text: string;
}[] = [
  {
    icon: UserCirclePlus,
    tone: "gold",
    who: "Vous",
    title: "Créez votre compte parent",
    text: "Votre nom, votre adresse e-mail, un mot de passe. Aucun moyen de paiement n'est demandé.",
  },
  {
    icon: UserPlus,
    tone: "ember",
    who: "Vous",
    title: "Ajoutez votre enfant",
    text: "Son prénom, sa classe et son pays : Wema suit le programme officiel qui le concerne. Son compte reste rattaché au vôtre.",
  },
  {
    icon: BookOpenText,
    tone: "indigo",
    who: "Vous",
    title: "Choisissez la matière",
    text: "Celle qui lui pose le plus de difficultés. L'essai gratuit démarre pour cette matière.",
  },
  {
    icon: ChatsCircle,
    tone: "orchid",
    who: "Votre enfant",
    title: "Premier entretien offert",
    text: "Le prof IA fait connaissance : ce qu'il aime, ce qui coince, les formats qui l'aident. Puis les premiers exercices, faits pour lui.",
  },
  {
    icon: ChartLineUp,
    tone: "emerald",
    who: "Ensemble",
    title: "Le suivi commence",
    text: "Il travaille avec son prof IA, qui le relance et le fait réviser. Vous suivez ses progrès dans votre espace parent.",
  },
];

export function Steps() {
  return (
    <section
      id="comment"
      aria-labelledby="steps-title"
      className="relative scroll-mt-28 px-4 py-24 sm:px-8 sm:py-32"
    >
      <div className="mx-auto w-full max-w-[1240px]">
        <SectionHeading
          id="steps-title"
          eyebrow="Comment ça marche"
          title={[
            "Cinq étapes,",
            <span key="l2" className="text-brand-active dark:text-brand">
              et il est au travail.
            </span>,
          ]}
          sub="Vous créez le compte et choisissez la matière. Le prof IA s'occupe du reste, à commencer par faire connaissance avec votre enfant."
        />

        <ol className="relative mt-14 grid gap-4 sm:mt-16 sm:grid-cols-2 lg:grid-cols-5 lg:gap-3">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-[54px] right-[10%] left-[10%] hidden border-t border-dashed border-foreground/20 lg:block"
          />
          {STEPS.map((step, index) => {
            const StepIcon = step.icon;
            const last = index === STEPS.length - 1;
            return (
              <li
                key={step.title}
                className={last ? "sm:col-span-2 lg:col-span-1" : undefined}
              >
                <Frame
                  className="h-full"
                  innerClassName="flex h-full flex-col gap-5 p-5 sm:p-6"
                >
                  <div className="flex items-center justify-between gap-3">
                    <GlowTile tone={step.tone} size={44}>
                      <StepIcon size={21} weight="bold" />
                    </GlowTile>
                    <span className="font-mono text-[30px] leading-none font-light tracking-[-0.04em] text-foreground/25 tabular-nums">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className="font-mono text-[11px] font-medium tracking-[0.08em] text-foreground/55 uppercase">
                      {index + 1}/{STEPS.length} · {step.who}
                    </span>
                    <h3 className="text-[19px] leading-snug font-semibold tracking-[-0.015em] text-foreground">
                      {step.title}
                    </h3>
                    <p className="text-[15px] leading-relaxed text-foreground/72">
                      {step.text}
                    </p>
                  </div>
                </Frame>
              </li>
            );
          })}
        </ol>

        <div className="mt-12 flex flex-col items-center gap-3 text-center">
          <TsfCta href={signupHref} tone="accent">
            Créer mon compte parent
          </TsfCta>
          <p className="font-mono text-[11.5px] tracking-[0.06em] text-foreground/55 uppercase">
            Essai gratuit · sans moyen de paiement
          </p>
        </div>
      </div>
    </section>
  );
}
