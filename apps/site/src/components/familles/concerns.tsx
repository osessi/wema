import type { Icon } from "@phosphor-icons/react";
import {
  BellRinging,
  Coins,
  Eye,
  HandHeart,
  ProhibitInset,
} from "@phosphor-icons/react/ssr";
import { Fragment } from "react";
import { Frame, SectionHeading } from "../../wa/components/v2/primitives";
import { GlowTile, type GlowTone } from "../../wa/ui/components/ui/glow-tile";

const CONCERNS: readonly {
  worry: string;
  icon: Icon;
  tone: GlowTone;
  answer: string;
  text: string;
  proof: string;
}[] = [
  {
    worry: "Il va tricher avec l'IA.",
    icon: ProhibitInset,
    tone: "crimson",
    answer: "Le prof IA ne donne jamais la réponse.",
    text: "Ni celle d'un exercice, ni celle d'un devoir. Il pose des questions, propose des indices de plus en plus précis et lui demande d'expliquer son raisonnement. C'est votre enfant qui trouve.",
    proof: "Indices progressifs",
  },
  {
    worry: "Il décroche au bout de deux jours.",
    icon: BellRinging,
    tone: "ember",
    answer: "Il le relance, puis le fait réviser.",
    text: "« Tu as fait l'exercice ? » Le prof IA revient vers lui quand il le faut, et repasse sur chaque notion quelques jours plus tard pour vérifier qu'elle tient.",
    proof: "Révision espacée",
  },
  {
    worry: "Je ne sais pas où il en est.",
    icon: Eye,
    tone: "indigo",
    answer: "Vous le voyez dans votre espace parent.",
    text: "Notions acquises, notions à revoir, temps de travail de la semaine, matière par matière. Chaque affirmation renvoie aux exercices sur lesquels elle s'appuie.",
    proof: "Preuves à l'appui",
  },
  {
    worry: "Il a un trouble dys.",
    icon: HandHeart,
    tone: "orchid",
    answer: "Le prof IA adapte sa façon d'enseigner.",
    text: "Vous déclarez son besoin : lecture facile, schémas, audio, bande dessinée. L'IA s'y ajuste. Elle ne pose jamais de diagnostic et ne cherche pas à repérer un trouble.",
    proof: "Déclaré par vous",
  },
  {
    worry: "Ça va coûter cher.",
    icon: Coins,
    tone: "gold",
    answer: "Vous ne payez que les matières utiles.",
    text: "Un abonnement par matière, après un essai gratuit qui ne demande aucun moyen de paiement. Le prix de votre pays est affiché avant tout paiement.",
    proof: "Essai gratuit",
  },
];

export function Concerns() {
  return (
    <section
      id="inquietudes"
      aria-labelledby="concerns-title"
      className="relative scroll-mt-28 px-4 py-24 sm:px-8 sm:py-32"
    >
      <div className="mx-auto w-full max-w-[1160px]">
        <SectionHeading
          id="concerns-title"
          eyebrow="Vos questions de parent"
          title={[
            "Ce qui vous inquiète,",
            <Fragment key="l2">
              <span className="text-brand-active dark:text-brand">
                et ce que Wema y répond.
              </span>
            </Fragment>,
          ]}
          sub="Confier son enfant à une IA pose des questions légitimes. Voici les cinq qu'on entend le plus, et comment le produit y répond concrètement."
        />

        <Frame className="mt-14 sm:mt-16">
          <div className="hidden grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] border-b border-foreground/10 font-mono text-[11.5px] font-medium tracking-[0.08em] text-foreground/55 uppercase md:grid">
            <span className="px-8 py-4">Vous vous dites</span>
            <span className="border-l border-foreground/10 px-8 py-4">
              Ce que fait Wema
            </span>
          </div>
          <ol>
            {CONCERNS.map((item, index) => {
              const ItemIcon = item.icon;
              return (
                <li
                  key={item.worry}
                  className="grid border-b border-foreground/10 last:border-b-0 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]"
                >
                  <div className="flex items-start gap-4 px-5 pt-7 pb-3 sm:px-8 md:py-8">
                    <span className="pt-1 font-mono text-[12px] font-medium text-foreground/45 tabular-nums">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <p className="text-[22px] leading-snug font-light tracking-[-0.025em] text-foreground/80 italic sm:text-[26px]">
                      « {item.worry} »
                    </p>
                  </div>
                  <div className="flex items-start gap-4 px-5 pt-3 pb-8 sm:px-8 md:border-l md:border-foreground/10 md:py-8">
                    <GlowTile
                      tone={item.tone}
                      size={44}
                      className="mt-0.5 shrink-0"
                    >
                      <ItemIcon size={21} weight="bold" />
                    </GlowTile>
                    <div className="flex min-w-0 flex-col gap-2">
                      <h3 className="text-[19px] leading-snug font-semibold tracking-[-0.015em] text-foreground sm:text-[20px]">
                        {item.answer}
                      </h3>
                      <p className="max-w-[540px] text-[16px] leading-relaxed text-foreground/72">
                        {item.text}
                      </p>
                      <span className="mt-1 inline-flex items-center gap-2 self-start font-mono text-[11px] font-medium tracking-[0.08em] text-foreground/55 uppercase">
                        <span
                          className="tk-diamond"
                          data-outline=""
                          aria-hidden="true"
                        />
                        {item.proof}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </Frame>
      </div>
    </section>
  );
}
